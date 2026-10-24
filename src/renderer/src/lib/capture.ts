import type { CaptureTarget, RecorderStartRequest, RecorderTrack } from '@shared/ipc'

const VIDEO_MIME_CANDIDATES = ['video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm']
const AUDIO_MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm']

const CHUNK_INTERVAL_MS = 1000
const AUDIO_BITRATE = 128_000

const pickMimeType = (candidates: string[]): string | undefined =>
  candidates.find((type) => MediaRecorder.isTypeSupported(type))

const videoBitrate = (track: RecorderTrack): number => (track === 'screen' ? 10_000_000 : 2_500_000)

export interface CaptureSession {
  tracks: RecorderTrack[]
  systemAudio: boolean
}

export const describeCaptureError = (error: unknown): string => {
  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotAllowedError':
        return 'Permission was denied. Grant access and try again.'
      case 'NotFoundError':
        return 'The selected source is no longer available. Pick another screen or window.'
      case 'NotReadableError':
        return 'The capture device is already in use by another application.'
      case 'OverconstrainedError':
        return 'The selected source does not support these capture settings.'
      case 'AbortError':
        return 'The capture request was cancelled.'
      default:
        return error.message || error.name
    }
  }

  return error instanceof Error ? error.message : 'Unable to start capture.'
}

/**
 * Owns the renderer-side MediaStreams and MediaRecorders. Chunks are pushed to
 * the main process as they arrive; nothing is buffered in memory for the whole
 * recording.
 */
export class CaptureController {
  private streams: Partial<Record<RecorderTrack, MediaStream>> = {}
  private recorders = new Map<RecorderTrack, MediaRecorder>()
  private queues = new Map<RecorderTrack, Promise<void>>()
  private aborted = false

  async acquire(request: RecorderStartRequest): Promise<CaptureSession> {
    const { target, options } = request
    const tracks: RecorderTrack[] = []
    let systemAudio = false

    try {
      this.streams.screen = await this.openDesktopStream(target, options.fps)
      tracks.push('screen')

      if (options.captureWebcam) {
        this.streams.webcam = await navigator.mediaDevices.getUserMedia({
          video: {
            frameRate: { ideal: options.fps, max: options.fps }
          },
          audio: false
        })
        tracks.push('webcam')
      }

      if (options.captureMicrophone) {
        this.streams.microphone = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: false
        })
        tracks.push('microphone')
      }

      if (options.captureSystemAudio) {
        try {
          const stream = await this.openDesktopStream(target, options.fps, true)

          if (stream.getAudioTracks().length === 0) {
            for (const track of stream.getTracks()) track.stop()
            throw new Error('The capture source did not provide an audio track')
          }

          for (const videoTrack of stream.getVideoTracks()) {
            videoTrack.stop()
            stream.removeTrack(videoTrack)
          }

          this.streams.systemAudio = stream
          tracks.push('systemAudio')
          systemAudio = true
        } catch (error) {
          console.warn('[capture] system audio is unavailable for this source', error)
        }
      }
    } catch (error) {
      this.releaseStreams()
      throw error
    }

    return { tracks, systemAudio }
  }

  async start(): Promise<void> {
    if (this.aborted) throw new Error('Capture was cancelled')

    for (const [track, stream] of this.entries()) {
      const recorder = this.createRecorder(track, stream)
      this.recorders.set(track, recorder)
      recorder.start(CHUNK_INTERVAL_MS)
    }

    await Promise.all(
      [...this.recorders.keys()].map((track) => window.api.recorder.trackStarted(track, Date.now()))
    )
  }

  pause(): void {
    for (const recorder of this.recorders.values()) {
      if (recorder.state === 'recording') recorder.pause()
    }
  }

  resume(): void {
    for (const recorder of this.recorders.values()) {
      if (recorder.state === 'paused') recorder.resume()
    }
  }

  async stop(): Promise<void> {
    await Promise.all(
      [...this.recorders.values()].map(
        (recorder) =>
          new Promise<void>((resolve) => {
            if (recorder.state === 'inactive') {
              resolve()
              return
            }
            recorder.addEventListener('stop', () => resolve(), { once: true })
            recorder.stop()
          })
      )
    )

    await Promise.all([...this.queues.values()])
    this.recorders.clear()
    this.queues.clear()
    this.releaseStreams()
  }

  /** Tear down without flushing, used when a start is cancelled or fails. */
  abort(): void {
    this.aborted = true

    for (const recorder of this.recorders.values()) {
      if (recorder.state !== 'inactive') {
        try {
          recorder.stop()
        } catch {
          // Already stopped.
        }
      }
    }

    this.recorders.clear()
    this.queues.clear()
    this.releaseStreams()
  }

  private entries(): Array<[RecorderTrack, MediaStream]> {
    const entries: Array<[RecorderTrack, MediaStream]> = []

    for (const track of ['screen', 'webcam', 'microphone', 'systemAudio'] as const) {
      const stream = this.streams[track]
      if (stream) entries.push([track, stream])
    }

    return entries
  }

  private async openDesktopStream(
    target: CaptureTarget,
    fps: number,
    withSystemAudio = false
  ): Promise<MediaStream> {
    const video = {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: target.id,
        maxFrameRate: fps,
        cursor: 'never'
      }
    }

    const audio = withSystemAudio ? { mandatory: { chromeMediaSource: 'desktop' } } : false

    return navigator.mediaDevices.getUserMedia({
      audio: audio as unknown as MediaTrackConstraints,
      video: video as unknown as MediaTrackConstraints
    })
  }

  private createRecorder(track: RecorderTrack, stream: MediaStream): MediaRecorder {
    const isAudioOnly = track === 'microphone' || track === 'systemAudio'
    const mimeType = pickMimeType(isAudioOnly ? AUDIO_MIME_CANDIDATES : VIDEO_MIME_CANDIDATES)

    const recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: videoBitrate(track),
      audioBitsPerSecond: AUDIO_BITRATE
    })

    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size === 0) return
      this.enqueue(track, event.data)
    })

    return recorder
  }

  private enqueue(track: RecorderTrack, blob: Blob): void {
    const previous = this.queues.get(track) ?? Promise.resolve()

    const next = previous
      .then(async () => {
        if (this.aborted) return
        const buffer = await blob.arrayBuffer()
        await window.api.recorder.appendChunk(track, buffer)
      })
      .catch((error) => {
        console.error(`[capture] failed to persist ${track} chunk`, error)
      })

    this.queues.set(track, next)
  }

  private releaseStreams(): void {
    for (const stream of Object.values(this.streams)) {
      stream?.getTracks().forEach((track) => track.stop())
    }
    this.streams = {}
  }
}
