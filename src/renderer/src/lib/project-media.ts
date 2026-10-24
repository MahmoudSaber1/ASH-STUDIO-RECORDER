import { parseEventLog, normalizePoint } from '@shared/events'
import { mediaUrl } from '@shared/media'
import type { ProjectFile } from '@shared/project'
import type { PointSample } from '@shared/cursor'
import type { RecorderInputEvent } from '@shared/recorder'
import { videoSecondsToActiveMs } from '@shared/sync'

export interface KeyPress {
  t: number
  keycode: number
}

export interface InputSamples {
  /** Cursor positions in normalized capture coordinates, sorted by time. */
  moves: PointSample[]
  clicks: PointSample[]
  keys: KeyPress[]
  /** False when the capture has no known bounds, so cursor data cannot be placed. */
  hasCursor: boolean
}

const toSamples = (events: RecorderInputEvent[], project: ProjectFile): InputSamples => {
  const bounds = project.captureBounds
  if (!bounds) return { moves: [], clicks: [], keys: [], hasCursor: false }

  const moves: PointSample[] = []
  const clicks: PointSample[] = []
  const keys: KeyPress[] = []

  for (const event of events) {
    if (event.type === 'keydown' && event.keycode !== undefined) {
      keys.push({ t: event.t, keycode: event.keycode })
      continue
    }
    if (event.x === undefined || event.y === undefined) continue

    const point = normalizePoint(event.x, event.y, bounds)
    const sample = { t: event.t, ...point }
    moves.push(sample)
    if (event.type === 'mousedown') clicks.push(sample)
  }

  return { moves, clicks, keys, hasCursor: true }
}

/**
 * The media for one project, loaded into hidden elements the editor and the
 * exporter both draw from. All times the class accepts are on the timeline,
 * which is the active recording clock that input events also use.
 */
export class ProjectMedia {
  readonly screen: HTMLVideoElement
  readonly webcam: HTMLVideoElement | null
  readonly mic: HTMLAudioElement | null
  readonly samples: InputSamples
  /** Timeline ms at which the screen track starts. */
  readonly screenOffsetMs: number
  readonly webcamOffsetMs: number
  readonly micOffsetMs: number
  /** Timeline ms at which the screen track ends. */
  readonly durationMs: number

  private constructor(
    project: ProjectFile,
    screen: HTMLVideoElement,
    webcam: HTMLVideoElement | null,
    mic: HTMLAudioElement | null,
    samples: InputSamples
  ) {
    this.screen = screen
    this.webcam = webcam
    this.mic = mic
    this.samples = samples

    const anchor = {
      epoch: project.timing.epoch,
      mediaStartedAt: project.mediaStartedAt.screen ?? project.timing.epoch
    }
    this.screenOffsetMs = anchor.mediaStartedAt - anchor.epoch
    this.webcamOffsetMs = (project.mediaStartedAt.webcam ?? anchor.mediaStartedAt) - anchor.epoch
    this.micOffsetMs = (project.mediaStartedAt.microphone ?? anchor.mediaStartedAt) - anchor.epoch

    const seconds = Number.isFinite(screen.duration) ? screen.duration : 0
    const fallback =
      Math.max(0, project.timing.endedAt ?? project.timing.epoch) - project.timing.epoch
    this.durationMs = seconds > 0 ? videoSecondsToActiveMs(seconds, anchor) : fallback
  }

  static async load(key: string, project: ProjectFile): Promise<ProjectMedia> {
    const screenFile = project.tracks.screen?.fileName
    if (!screenFile) throw new Error('This project has no screen recording')

    const screen = document.createElement('video')
    screen.crossOrigin = 'anonymous'
    screen.preload = 'auto'
    screen.muted = true
    screen.src = mediaUrl(key, screenFile)

    const webcamFile = project.tracks.webcam?.fileName
    const webcam = webcamFile ? document.createElement('video') : null
    if (webcam && webcamFile) {
      webcam.crossOrigin = 'anonymous'
      webcam.preload = 'auto'
      webcam.muted = true
      webcam.src = mediaUrl(key, webcamFile)
    }

    const micFile = project.tracks.microphone?.fileName
    const mic = micFile ? document.createElement('audio') : null
    if (mic && micFile) {
      mic.crossOrigin = 'anonymous'
      mic.preload = 'auto'
      mic.src = mediaUrl(key, micFile)
    }

    const eventsText = await fetch(mediaUrl(key, project.events.fileName))
      .then((response) => (response.ok ? response.text() : ''))
      .catch(() => '')
    const samples = toSamples(parseEventLog(eventsText), project)

    await Promise.all([
      waitForMetadata(screen),
      webcam ? waitForMetadata(webcam) : Promise.resolve()
    ])

    return new ProjectMedia(project, screen, webcam, mic, samples)
  }

  /** Seeks the screen track to a timeline time and resolves once the frame is ready. */
  seekScreen(timelineMs: number): Promise<void> {
    return seekTo(this.screen, (timelineMs - this.screenOffsetMs) / 1000)
  }

  seekWebcam(timelineMs: number): Promise<void> {
    if (!this.webcam) return Promise.resolve()
    return seekTo(this.webcam, (timelineMs - this.webcamOffsetMs) / 1000)
  }

  /** Converts a timeline time to a screen track time, clamped to the track. */
  screenSecondsAt(timelineMs: number): number {
    const seconds = (timelineMs - this.screenOffsetMs) / 1000
    return Math.min(Math.max(seconds, 0), this.screen.duration || 0)
  }

  dispose(): void {
    for (const element of [this.screen, this.webcam, this.mic]) {
      if (!element) continue
      element.pause()
      element.removeAttribute('src')
      element.load()
    }
  }
}

const waitForMetadata = (element: HTMLMediaElement): Promise<void> =>
  new Promise((resolve, reject) => {
    if (element.readyState >= 1) {
      resolve()
      return
    }
    element.addEventListener('loadedmetadata', () => resolve(), { once: true })
    element.addEventListener(
      'error',
      () =>
        reject(new Error(`Could not load media (${element.error?.message ?? 'unknown error'})`)),
      { once: true }
    )
  })

const seekTo = (video: HTMLVideoElement, seconds: number): Promise<void> =>
  new Promise((resolve) => {
    const target = Math.min(
      Math.max(seconds, 0),
      Number.isFinite(video.duration) ? video.duration : seconds
    )
    if (Math.abs(video.currentTime - target) < 0.001 && video.readyState >= 2) {
      resolve()
      return
    }
    video.addEventListener('seeked', () => resolve(), { once: true })
    video.currentTime = target
  })
