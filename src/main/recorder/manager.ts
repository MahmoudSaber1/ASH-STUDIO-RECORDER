import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { app, BrowserWindow, shell, systemPreferences } from 'electron'
import {
  IPC_EVENTS,
  type InputTrackingStatus,
  type RecorderInputEvent,
  type RecorderOptions,
  type RecorderPhase,
  type RecorderStartRequest,
  type RecorderState,
  type RecorderTrack
} from '@shared/ipc'
import {
  registerSessionShortcuts,
  registerStartShortcut as registerGlobalStartShortcut,
  unregisterSessionShortcuts,
  unregisterStartShortcut as unregisterGlobalStartShortcut
} from '@main/shortcuts'
import {
  hideRecorderToolbar,
  minimizeMainWindow,
  restoreMainWindow,
  showRecorderToolbar
} from '@main/window'
import { ChunkWriter } from './chunk-writer'
import { EventsWriter } from './events-writer'
import { InputTracker } from './input-tracker'
import { ManifestWriter, type RecordingManifest, type RecordingTrackInfo } from './manifest'
import { recoverInterruptedRecordings } from './recovery'
import { createSessionDir, EVENTS_FILE, MANIFEST_FILE } from './paths'

const MAX_CHUNK_BYTES = 64 * 1024 * 1024

/** How long the capture window gets to hand back its last chunks after stop. */
const STOP_GRACE_MS = 8000

const TRACK_FILE_NAMES: Record<RecorderTrack, string> = {
  screen: 'screen',
  webcam: 'webcam',
  microphone: 'microphone',
  systemAudio: 'system-audio'
}

interface SessionTrack {
  writer: ChunkWriter
  fileName: string
}

interface Session {
  id: string
  dir: string
  request: RecorderStartRequest
  epoch: number
  startedAt: number
  pausedAt: number | null
  pausedTotalMs: number
  stoppedAt: number | null
  phase: 'recording' | 'paused' | 'stopping'
  tracks: Map<RecorderTrack, SessionTrack>
  mediaStartedAt: Partial<Record<RecorderTrack, number>>
  events: EventsWriter
  eventCount: number
  inputTracker: InputTracker
  inputTracking: InputTrackingStatus
  manifest: ManifestWriter
  timer: NodeJS.Timeout | null
  stopTimeout: NodeJS.Timeout | null
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const shortcutWarning = (accelerator: string): string =>
  `${accelerator} is already used by another app, so that shortcut is unavailable.`

export class RecorderManager {
  private session: Session | null = null
  private phase: RecorderPhase = 'idle'
  private error: string | null = null
  private projectDir: string | null = null
  private lastTarget: RecorderState['target'] = null
  private lastSessionId: string | null = null
  private lastStartedAt: number | null = null
  private finalElapsedMs = 0
  private startShortcutHandler: (() => void) | null = null
  private finalizing: Promise<RecorderState> | null = null
  /** Problems found at launch, such as a shortcut taken by another app. */
  private shortcutWarnings: string[] = []
  /** Problems found while the current session runs, such as missing permissions. */
  private sessionWarnings: string[] = []

  getState(): RecorderState {
    const session = this.session
    const warnings = [...this.shortcutWarnings, ...this.sessionWarnings]

    if (!session) {
      return {
        phase: this.phase,
        sessionId: this.lastSessionId,
        startedAt: this.lastStartedAt,
        elapsedMs: this.finalElapsedMs,
        target: this.lastTarget,
        projectDir: this.projectDir,
        activeTracks: [],
        inputTracking: 'inactive',
        error: this.error,
        warnings
      }
    }

    return {
      phase: this.phase,
      sessionId: session.id,
      startedAt: session.startedAt,
      elapsedMs: this.elapsedFor(session),
      target: session.request.target,
      projectDir: session.dir,
      activeTracks: [...session.tracks.keys()],
      inputTracking: session.inputTracking,
      error: this.error,
      warnings
    }
  }

  /** True while a session exists, including the stop and save phase. */
  isRecording(): boolean {
    return this.session !== null
  }

  setStartShortcut(handler: () => void): void {
    this.startShortcutHandler = handler
    this.shortcutWarnings = registerGlobalStartShortcut(handler).map(shortcutWarning)
  }

  async recoverInterruptedSessions(): Promise<void> {
    const recovered = await recoverInterruptedRecordings()
    if (recovered > 0) {
      console.warn(`[recorder] recovered ${recovered} interrupted recording(s)`)
    }
  }

  async start(request: RecorderStartRequest): Promise<RecorderState> {
    if (this.session) throw new Error('A recording is already in progress')

    if (request.options.captureSystemAudio && process.platform !== 'win32') {
      throw new Error('System audio capture is only supported on Windows')
    }

    const { id, dir } = await createSessionDir(request.target.name)
    const epoch = Date.now()
    const enabledTracks = this.resolveTracks(request.options)
    const tracks = new Map<RecorderTrack, SessionTrack>()

    let events: EventsWriter | null = null
    let manifest: ManifestWriter | null = null

    try {
      for (const track of enabledTracks) {
        const writer = await ChunkWriter.create(dir, TRACK_FILE_NAMES[track])
        tracks.set(track, { writer, fileName: `${TRACK_FILE_NAMES[track]}.webm` })
      }

      events = new EventsWriter(join(dir, EVENTS_FILE))

      const manifestData: RecordingManifest = {
        schemaVersion: 1,
        id,
        app: { name: app.getName(), version: app.getVersion() },
        status: 'recording',
        createdAt: new Date(epoch).toISOString(),
        updatedAt: new Date(epoch).toISOString(),
        target: request.target,
        options: request.options,
        timing: {
          epoch,
          startedAt: epoch,
          endedAt: null,
          pausedTotalMs: 0,
          clock: 'active'
        },
        mediaStartedAt: {},
        tracks: {},
        events: { fileName: EVENTS_FILE, count: 0 },
        notes: []
      }

      manifest = new ManifestWriter(join(dir, MANIFEST_FILE), manifestData)
      await manifest.update()
    } catch (error) {
      for (const { writer } of tracks.values()) await writer.abort()
      if (events) await events.finish().catch(() => undefined)
      if (manifest) await manifest.close().catch(() => undefined)
      await rm(dir, { recursive: true, force: true }).catch(() => undefined)
      this.error = errorMessage(error)
      throw error
    }

    if (!events || !manifest) {
      throw new Error('Recording session failed to initialize')
    }

    const session: Session = {
      id,
      dir,
      request,
      epoch,
      startedAt: epoch,
      pausedAt: null,
      pausedTotalMs: 0,
      stoppedAt: null,
      phase: 'recording',
      tracks,
      mediaStartedAt: {},
      events,
      eventCount: 0,
      inputTracker: new InputTracker({
        logKeys: request.options.logKeys,
        clock: () => (this.session ? this.elapsedFor(this.session) : 0),
        onEvent: (event) => this.recordEvent(event)
      }),
      inputTracking: 'inactive',
      manifest,
      timer: null,
      stopTimeout: null
    }

    this.session = session
    this.phase = 'recording'
    this.error = null
    this.sessionWarnings = []
    this.projectDir = dir
    this.lastTarget = request.target
    this.lastSessionId = id
    this.lastStartedAt = epoch
    this.finalElapsedMs = 0

    session.inputTracking = this.startInputTracking(session)

    unregisterGlobalStartShortcut()
    this.sessionWarnings.push(
      ...registerSessionShortcuts({
        togglePause: () => {
          this.togglePause()
        },
        stop: () => {
          this.stop()
        }
      }).map(shortcutWarning)
    )
    showRecorderToolbar()
    minimizeMainWindow()
    this.startTimer(session)
    this.broadcast()

    return this.getState()
  }

  trackStarted(track: RecorderTrack, startedAt: number): void {
    const session = this.session
    if (!session || !session.tracks.has(track)) return
    if (!Number.isFinite(startedAt)) return

    session.mediaStartedAt[track] = startedAt
    session.manifest.data.mediaStartedAt[track] = startedAt
    void session.manifest.update()
  }

  async appendChunk(track: RecorderTrack, chunk: ArrayBuffer): Promise<void> {
    const session = this.session
    const isActive =
      this.phase === 'recording' || this.phase === 'paused' || this.phase === 'stopping'

    if (!session || !isActive) return

    const entry = session.tracks.get(track)
    if (!entry) return
    if (!(chunk instanceof ArrayBuffer)) throw new Error('Invalid media chunk payload')
    if (chunk.byteLength === 0) return
    if (chunk.byteLength > MAX_CHUNK_BYTES) {
      throw new Error('Media chunk exceeds the maximum allowed size')
    }

    await entry.writer.append(Buffer.from(chunk))
  }

  /**
   * `at` is the wall-clock time the renderer actually paused its MediaRecorders.
   * Using it keeps the event clock aligned with the video instead of the IPC arrival time.
   */
  pause(at?: number): RecorderState {
    const session = this.session
    if (!session || this.phase !== 'recording') return this.getState()

    session.pausedAt = this.clampTime(session, at)
    session.phase = 'paused'
    this.phase = 'paused'
    session.inputTracker.stop()
    session.inputTracking = 'inactive'
    this.stopTimer(session)
    void session.manifest.update((data) => {
      data.timing.pausedTotalMs = session.pausedTotalMs
    })
    this.broadcast()

    return this.getState()
  }

  resume(at?: number): RecorderState {
    const session = this.session
    if (!session || this.phase !== 'paused' || session.pausedAt === null) return this.getState()

    const resumedAt = this.clampTime(session, at)
    session.pausedTotalMs += Math.max(0, resumedAt - session.pausedAt)
    session.pausedAt = null
    session.phase = 'recording'
    this.phase = 'recording'
    session.inputTracking = this.startInputTracking(session)
    this.startTimer(session)
    void session.manifest.update((data) => {
      data.timing.pausedTotalMs = session.pausedTotalMs
    })
    this.broadcast()

    return this.getState()
  }

  togglePause(): RecorderState {
    if (this.phase === 'recording') return this.pause()
    if (this.phase === 'paused') return this.resume()
    return this.getState()
  }

  stop(): RecorderState {
    const session = this.session
    if (!session) return this.getState()
    if (this.phase !== 'recording' && this.phase !== 'paused') return this.getState()

    const stoppedAt = Date.now()
    session.stoppedAt = stoppedAt
    if (session.pausedAt !== null) {
      session.pausedTotalMs += Math.max(0, stoppedAt - session.pausedAt)
      session.pausedAt = null
    }

    session.phase = 'stopping'
    this.phase = 'stopping'
    session.inputTracker.stop()
    session.inputTracking = 'inactive'
    this.stopTimer(session)
    unregisterSessionShortcuts()
    void session.manifest.update((data) => {
      data.timing.pausedTotalMs = session.pausedTotalMs
    })

    // If the capture window never calls stopComplete (closed, reloaded, crashed),
    // save what the main process already has instead of staying stuck in "stopping".
    session.stopTimeout = setTimeout(() => {
      void this.forceFinalize()
    }, STOP_GRACE_MS)

    this.broadcast()

    return this.getState()
  }

  async stopComplete(): Promise<RecorderState> {
    const session = this.session
    if (!session || this.phase !== 'stopping') return this.getState()

    return this.finalizeSession(session, 'completed')
  }

  async openProjectFolder(): Promise<boolean> {
    if (!this.projectDir) return false
    const error = await shell.openPath(this.projectDir)
    return error === ''
  }

  /** Resolves once no session is active, or after the timeout. */
  waitForRecordingEnd(timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      const deadline = Date.now() + timeoutMs
      const check = (): void => {
        if (!this.session || Date.now() >= deadline) {
          resolve()
          return
        }
        setTimeout(check, 100)
      }
      check()
    })
  }

  shutdown(): void {
    const session = this.session
    if (session) {
      session.inputTracker.stop()
      this.stopTimer(session)
      if (session.stopTimeout) clearTimeout(session.stopTimeout)
      unregisterSessionShortcuts()
    }
    unregisterGlobalStartShortcut()
  }

  private async forceFinalize(): Promise<void> {
    const session = this.session
    if (!session || this.phase !== 'stopping') return

    await this.finalizeSession(
      session,
      'incomplete',
      'The capture window did not finish in time. The recording was saved from the data already received.'
    )
  }

  private finalizeSession(
    session: Session,
    status: 'completed' | 'incomplete',
    note?: string
  ): Promise<RecorderState> {
    if (!this.finalizing) {
      this.finalizing = this.runFinalize(session, status, note).finally(() => {
        this.finalizing = null
      })
    }
    return this.finalizing
  }

  private async runFinalize(
    session: Session,
    status: 'completed' | 'incomplete',
    note?: string
  ): Promise<RecorderState> {
    if (session.stopTimeout) {
      clearTimeout(session.stopTimeout)
      session.stopTimeout = null
    }

    const endedAt = Date.now()
    const elapsedMs = this.elapsedFor(session)

    for (const [track, entry] of session.tracks) {
      try {
        const finalized = await entry.writer.finalize()
        if (finalized) {
          const info: RecordingTrackInfo = {
            fileName: finalized.fileName,
            bytes: finalized.bytes,
            startedAt: session.mediaStartedAt[track] ?? session.startedAt
          }
          session.manifest.data.tracks[track] = info
        } else {
          session.manifest.data.notes.push(`No media was captured for ${track}.`)
        }
      } catch (error) {
        session.manifest.data.notes.push(`Could not finalize ${track}: ${errorMessage(error)}`)
      }
    }

    await session.events.finish().catch((error) => {
      session.manifest.data.notes.push(`Could not flush input events: ${errorMessage(error)}`)
    })

    if (note) session.manifest.data.notes.push(note)
    session.manifest.data.status = status
    session.manifest.data.timing.endedAt = endedAt
    session.manifest.data.timing.pausedTotalMs = session.pausedTotalMs
    session.manifest.data.mediaStartedAt = { ...session.mediaStartedAt }
    session.manifest.data.events.count = session.eventCount
    await session.manifest.update()
    await session.manifest.close()

    this.session = null
    this.finalElapsedMs = elapsedMs
    this.phase = status === 'completed' ? 'completed' : 'error'
    this.error = status === 'completed' ? null : (note ?? null)
    hideRecorderToolbar()
    restoreMainWindow()
    this.restoreStartShortcut()
    this.broadcast()

    return this.getState()
  }

  private startInputTracking(session: Session): InputTrackingStatus {
    if (process.platform === 'darwin' && !systemPreferences.isTrustedAccessibilityClient(false)) {
      this.addSessionWarning(
        'Accessibility access is off, so cursor and click data will not be recorded. Turn it on in System Settings and start a new recording.'
      )
      return 'unavailable'
    }

    if (session.inputTracker.start()) return 'active'

    this.addSessionWarning(
      'Global input tracking could not start. Cursor data will be missing from this recording.'
    )
    return 'unavailable'
  }

  private addSessionWarning(message: string): void {
    if (!this.sessionWarnings.includes(message)) this.sessionWarnings.push(message)
  }

  private clampTime(session: Session, at: number | undefined): number {
    const now = Date.now()
    if (at === undefined || !Number.isFinite(at)) return now
    return Math.min(Math.max(at, session.epoch), now)
  }

  private resolveTracks(options: RecorderOptions): RecorderTrack[] {
    const tracks: RecorderTrack[] = ['screen']
    if (options.captureWebcam) tracks.push('webcam')
    if (options.captureMicrophone) tracks.push('microphone')
    if (options.captureSystemAudio) tracks.push('systemAudio')
    return tracks
  }

  private elapsedFor(session: Session): number {
    const reference = session.pausedAt ?? session.stoppedAt ?? Date.now()
    return Math.max(0, reference - session.epoch - session.pausedTotalMs)
  }

  private recordEvent(event: RecorderInputEvent): void {
    const session = this.session
    if (!session || session.phase === 'stopping') return

    session.events.append(event)
    session.eventCount += 1

    if (session.eventCount % 120 === 0) {
      void session.manifest.update((data) => {
        data.events.count = session.eventCount
      })
    }
  }

  private startTimer(session: Session): void {
    this.stopTimer(session)
    session.timer = setInterval(() => {
      this.broadcast()
    }, 1000)
  }

  private stopTimer(session: Session): void {
    if (session.timer) {
      clearInterval(session.timer)
      session.timer = null
    }
  }

  private restoreStartShortcut(): void {
    if (this.startShortcutHandler) {
      registerGlobalStartShortcut(this.startShortcutHandler)
    }
  }

  private broadcast(): void {
    const state = this.getState()
    for (const window of BrowserWindow.getAllWindows()) {
      if (window.isDestroyed() || window.webContents.isDestroyed()) continue
      window.webContents.send(IPC_EVENTS.recorderState, state)
    }
  }
}

export const recorderManager = new RecorderManager()
