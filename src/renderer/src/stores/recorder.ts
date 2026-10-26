import { create } from 'zustand'
import {
  DEFAULT_RECORDER_OPTIONS,
  type CaptureSource,
  type CaptureTarget,
  type RecorderOptions,
  type RecorderPhase,
  type RecorderState,
  type RecorderTrack
} from '@shared/ipc'
import { CaptureController, describeCaptureError } from '@renderer/lib/capture'
import { usePlatformStore } from './platform'

type LocalPhase = 'idle' | 'acquiring' | 'countdown' | 'starting'
type SourcesStatus = 'idle' | 'loading' | 'ready' | 'error'

interface RecorderStore {
  phase: RecorderPhase
  localPhase: LocalPhase
  countdown: number
  sessionId: string | null
  startedAt: number | null
  elapsedMs: number
  projectDir: string | null
  activeTracks: RecorderTrack[]
  inputTracking: RecorderState['inputTracking']
  error: string | null
  warnings: string[]
  target: CaptureTarget | null
  options: RecorderOptions
  sources: CaptureSource[]
  sourcesStatus: SourcesStatus
  sourcesError: string | null
  loadSources: (force?: boolean) => Promise<void>
  selectTarget: (source: CaptureSource) => void
  updateOptions: (patch: Partial<RecorderOptions>) => void
  start: () => Promise<void>
  cancelStart: () => void
  pause: () => Promise<void>
  resume: () => Promise<void>
  stop: () => Promise<void>
  reset: () => void
  openProjectFolder: () => Promise<void>
}

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

const screenGranted = (): boolean =>
  usePlatformStore
    .getState()
    .permissions.some(
      (permission) => permission.kind === 'screen' && permission.status === 'granted'
    )

const toTarget = (source: CaptureSource): CaptureTarget => ({
  id: source.id,
  name: source.name,
  kind: source.kind,
  ...(source.displayId ? { displayId: source.displayId } : {})
})

let activeController: CaptureController | null = null
let startAttempt = 0
let finalizePromise: Promise<void> | null = null

const isToolbarWindow = typeof window !== 'undefined' && window.location.hash === '#toolbar'

export const useRecorderStore = create<RecorderStore>((set, get) => ({
  phase: 'idle',
  localPhase: 'idle',
  countdown: 0,
  sessionId: null,
  startedAt: null,
  elapsedMs: 0,
  projectDir: null,
  activeTracks: [],
  inputTracking: 'inactive',
  error: null,
  warnings: [],
  target: null,
  options: DEFAULT_RECORDER_OPTIONS,
  sources: [],
  sourcesStatus: 'idle',
  sourcesError: null,

  loadSources: async (force = false) => {
    if (get().sourcesStatus === 'loading') return
    if (!force && get().sources.length > 0) return

    if (!screenGranted()) {
      set({ sources: [], sourcesStatus: 'idle', sourcesError: null })
      return
    }

    set({ sourcesStatus: 'loading', sourcesError: null })

    try {
      const sources = await window.api.platform.getSources({
        kinds: ['screen', 'window'],
        thumbnails: true,
        // Large enough for portrait displays; cards letterbox to the real aspect.
        thumbnailSize: { width: 640, height: 640 },
        fetchWindowIcons: true
      })

      set({ sources, sourcesStatus: 'ready', sourcesError: null })

      const current = get().target
      if (!current || !sources.some((source) => source.id === current.id)) {
        const fallback = sources.find((source) => source.kind === 'screen') ?? sources[0]
        if (fallback) set({ target: toTarget(fallback) })
      }
    } catch (error) {
      set({ sourcesStatus: 'error', sourcesError: describeCaptureError(error) })
    }
  },

  selectTarget: (source) => {
    set({ target: toTarget(source), error: null })
  },

  updateOptions: (patch) => {
    set((state) => ({ options: { ...state.options, ...patch } }))
  },

  start: async () => {
    const state = get()

    if (state.localPhase !== 'idle') return
    if (state.phase === 'recording' || state.phase === 'paused' || state.phase === 'stopping') {
      return
    }
    if (!state.target) {
      set({ error: 'Choose a screen or window to record.' })
      return
    }

    const attempt = ++startAttempt
    const { target, options } = state
    const controller = new CaptureController()
    activeController = controller

    set({ localPhase: 'acquiring', countdown: 0, error: null })

    try {
      const session = await controller.acquire({ target, options })
      if (attempt !== startAttempt) {
        controller.abort()
        activeController = null
        return
      }

      if (options.captureSystemAudio && !session.systemAudio) {
        set({
          error: 'System audio is not available for this source. Recording without it.'
        })
      }

      if (options.countdownMs > 0) {
        const seconds = Math.ceil(options.countdownMs / 1000)
        set({ localPhase: 'countdown', countdown: seconds })

        for (let remaining = seconds; remaining > 0; remaining -= 1) {
          await delay(1000)
          if (attempt !== startAttempt) {
            controller.abort()
            activeController = null
            return
          }
          set({ countdown: remaining - 1 })
        }
      }

      set({ localPhase: 'starting' })
      const started = await window.api.recorder.start({ target, options })

      if (attempt !== startAttempt) {
        controller.abort()
        activeController = null
        await window.api.recorder.stop().catch(() => undefined)
        await window.api.recorder.stopComplete().catch(() => undefined)
        set({ localPhase: 'idle', countdown: 0 })
        return
      }

      applyState(started)

      // Give the main window time to finish minimizing before the first frame.
      await delay(250)
      await controller.start()

      set({ localPhase: 'idle', countdown: 0 })
    } catch (error) {
      controller.abort()
      activeController = null

      const current = await window.api.recorder.getState().catch(() => null)
      if (current && (current.phase === 'recording' || current.phase === 'paused')) {
        await window.api.recorder.stop().catch(() => undefined)
        await window.api.recorder.stopComplete().catch(() => undefined)
      }

      set({
        localPhase: 'idle',
        countdown: 0,
        error: describeCaptureError(error)
      })
    }
  },

  cancelStart: () => {
    if (get().localPhase === 'idle') return
    startAttempt += 1
    set({ localPhase: 'idle', countdown: 0 })
    activeController?.abort()
    activeController = null
  },

  pause: async () => {
    try {
      // Pause the MediaRecorders first and report that exact moment, so the
      // event clock stops where the video stops.
      const at = Date.now()
      activeController?.pause()
      const state = await window.api.recorder.pause(at)
      applyState(state)
    } catch (error) {
      set({ error: describeCaptureError(error) })
    }
  },

  resume: async () => {
    try {
      const at = Date.now()
      activeController?.resume()
      const state = await window.api.recorder.resume(at)
      applyState(state)
    } catch (error) {
      set({ error: describeCaptureError(error) })
    }
  },

  stop: async () => {
    if (get().localPhase !== 'idle') return
    try {
      const state = await window.api.recorder.stop()
      applyState(state)
      if (state.phase === 'stopping') await finalizeRecording()
    } catch (error) {
      set({ error: describeCaptureError(error) })
    }
  },

  reset: () => {
    const phase = get().phase
    if (phase === 'recording' || phase === 'paused' || phase === 'stopping') return

    set({
      phase: 'idle',
      localPhase: 'idle',
      countdown: 0,
      sessionId: null,
      startedAt: null,
      elapsedMs: 0,
      projectDir: null,
      activeTracks: [],
      inputTracking: 'inactive',
      error: null
    })
  },

  openProjectFolder: async () => {
    await window.api.recorder.openProjectFolder()
  }
}))

const applyState = (state: RecorderState): void => {
  const previousPhase = useRecorderStore.getState().phase

  // Any window can pause or resume through the main process. Keep the
  // renderer that actually owns the MediaRecorders in sync with that phase.
  if (state.phase === 'paused' && previousPhase !== 'paused') {
    activeController?.pause()
  } else if (state.phase === 'recording' && previousPhase === 'paused') {
    activeController?.resume()
  }

  useRecorderStore.setState((previous) => ({
    phase: state.phase,
    sessionId: state.sessionId,
    startedAt: state.startedAt,
    elapsedMs: state.elapsedMs,
    projectDir: state.projectDir,
    activeTracks: state.activeTracks,
    inputTracking: state.inputTracking,
    warnings: state.warnings,
    // Keep a local error until the phase changes, so the 1-second timer
    // broadcasts do not wipe it. Phase changes clear stale errors.
    error: state.error ?? (state.phase === previousPhase ? previous.error : null)
  }))
}

const finalizeRecording = (): Promise<void> => {
  if (finalizePromise) return finalizePromise

  finalizePromise = (async () => {
    try {
      await activeController?.stop()
    } catch (error) {
      console.error('[recorder] failed to stop capture', error)
    }

    try {
      const state = await window.api.recorder.stopComplete()
      activeController = null
      applyState(state)
    } catch (error) {
      activeController = null
      useRecorderStore.setState({
        error: `Could not finish the recording: ${describeCaptureError(error)}`
      })
    }
  })().finally(() => {
    finalizePromise = null
  })

  return finalizePromise
}

if (typeof window !== 'undefined' && window.api) {
  window.api.recorder.onState((state) => {
    applyState(state)
    if (!isToolbarWindow && state.phase === 'stopping') {
      void finalizeRecording()
    }
  })

  if (!isToolbarWindow) {
    window.api.recorder.onStartShortcut(() => {
      void useRecorderStore.getState().start()
    })
  }

  void window.api.recorder
    .getState()
    .then(applyState)
    .catch(() => undefined)
}
