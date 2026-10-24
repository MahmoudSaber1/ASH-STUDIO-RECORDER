import { create } from 'zustand'
import type { PointSample } from '@shared/cursor'
import { detectZoomSegments } from '@shared/zoom'
import {
  addZoomSegment,
  deleteRange,
  findIdleRanges,
  removeSpeedRamp,
  removeZoomSegment,
  restoreRange,
  setSpeedRamp,
  setTrim,
  splitAt,
  updateZoomSegment
} from '@shared/editing'
import { mediaUrl } from '@shared/media'
import {
  createDefaultEditor,
  type EditorState,
  type ProjectFile,
  type TimeRange,
  type ZoomSegment
} from '@shared/project'
import { buildSegments, outputDurationMs, type Segment } from '@shared/timeline'
import type { RecorderInputEvent } from '@shared/recorder'
import { ProjectMedia } from '@renderer/lib/project-media'
import { loadWaveform } from '@renderer/lib/waveform'

export const WAVEFORM_BUCKETS = 1200
const SAVE_DELAY_MS = 800
const COALESCE_WINDOW_MS = 1000
const IDLE_SPEED = 4

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'
export type SaveStatus = 'saved' | 'pending' | 'saving' | 'error'

interface Coalesce {
  key: string
  at: number
}

export interface EditorStore {
  key: string | null
  project: ProjectFile | null
  media: ProjectMedia | null
  status: LoadStatus
  error: string | null
  editor: EditorState
  past: EditorState[]
  future: EditorState[]
  saveStatus: SaveStatus
  notice: string | null
  playheadMs: number
  playing: boolean
  /** Bumped when a seek finishes, so the preview redraws a paused frame. */
  frameVersion: number
  selection: TimeRange | null
  selectedZoomId: string | null
  pxPerSecond: number
  waveform: Float32Array | null
  exportOpen: boolean

  load: (key: string) => Promise<void>
  close: () => void
  update: (next: (editor: EditorState) => EditorState, coalesce?: string) => void
  undo: () => void
  redo: () => void
  seek: (ms: number) => Promise<void>
  togglePlay: () => void
  setPxPerSecond: (value: number) => void
  setSelection: (range: TimeRange | null) => void
  setSelectedZoom: (id: string | null) => void
  setExportOpen: (open: boolean) => void
  split: () => void
  deleteSelection: () => void
  restoreSelection: () => void
  restoreAll: () => void
  trimToSelection: () => void
  clearTrim: () => void
  speedSelection: (speed: number) => void
  removeRamp: (id: string) => void
  speedUpIdle: () => void
  addZoomAtPlayhead: () => void
  detectZoom: () => void
  updateZoom: (id: string, patch: Partial<ZoomSegment>) => void
  removeZoom: (id: string) => void
  renameProject: (name: string) => Promise<void>
  clearNotice: () => void
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
let lastCoalesce: Coalesce | null = null
let seekToken = 0
let loopFrame: number | null = null

const clampMs = (value: number, min: number, max?: number): number =>
  Math.min(Math.max(value, min), max ?? Number.POSITIVE_INFINITY)

const cancelFrame = (): void => {
  if (loopFrame !== null) cancelAnimationFrame(loopFrame)
  loopFrame = null
}

const scheduleSave = (
  get: () => EditorStore,
  set: (partial: Partial<EditorStore>) => void
): void => {
  if (saveTimer) clearTimeout(saveTimer)
  set({ saveStatus: 'pending' })
  saveTimer = setTimeout(() => {
    const { key, editor } = get()
    if (!key) return
    set({ saveStatus: 'saving' })
    window.api.projects
      .saveEditor(key, editor)
      .then(() => {
        set({ saveStatus: 'saved' })
      })
      .catch(() => {
        set({ saveStatus: 'error' })
      })
  }, SAVE_DELAY_MS)
}

/** 0 to 1 gain from the fade in and fade out settings, relative to the trimmed edit. */
const fadeFactor = (editor: EditorState, timelineMs: number, durationMs: number): number => {
  const start = editor.trim?.start ?? 0
  const end = editor.trim?.end ?? durationMs
  let gain = 1
  if (editor.audio.fadeInMs > 0)
    gain = Math.min(gain, clampMs((timelineMs - start) / editor.audio.fadeInMs, 0, 1))
  if (editor.audio.fadeOutMs > 0)
    gain = Math.min(gain, clampMs((end - timelineMs) / editor.audio.fadeOutMs, 0, 1))
  return gain
}

/** The segment that plays at a timeline time, or null when that time is cut. */
const segmentAt = (segments: Segment[], timelineMs: number): Segment | null =>
  segments.find((segment) => timelineMs >= segment.start && timelineMs < segment.end) ?? null

export const useEditor = create<EditorStore>((set, get) => {
  const applySpeedAndAudio = (): void => {
    const { media, editor, playheadMs } = get()
    if (!media) return
    const segment = segmentAt(buildSegments(media.durationMs, editor), playheadMs)
    const rate = segment?.speed ?? 1
    if (Math.abs(media.screen.playbackRate - rate) > 0.001) media.screen.playbackRate = rate
    if (media.mic) {
      // HTMLMediaElement.volume is capped at 1 in the preview. Exports can boost past it.
      const gain =
        rate === 1 ? editor.audio.micVolume * fadeFactor(editor, playheadMs, media.durationMs) : 0
      media.mic.volume = Math.min(Math.max(gain, 0), 1)
    }
  }

  const tick = (): void => {
    const state = get()
    const { media, playing } = state
    if (!media || !playing) {
      loopFrame = null
      return
    }

    const timelineMs = media.screenOffsetMs + media.screen.currentTime * 1000
    const segments = buildSegments(media.durationMs, state.editor)
    const end = segments[segments.length - 1]?.end ?? 0

    if (media.screen.ended || timelineMs >= end || timelineMs >= media.durationMs - 1) {
      media.screen.pause()
      media.mic?.pause()
      set({ playing: false, playheadMs: Math.min(end, media.durationMs) })
      loopFrame = null
      return
    }

    let current = timelineMs
    if (!segmentAt(segments, timelineMs)) {
      // Skip over removed time to the next kept clip.
      const next = segments.find((segment) => segment.start > timelineMs)
      if (next) {
        current = next.start
        media.screen.currentTime = (next.start - media.screenOffsetMs) / 1000
      }
    }

    applySpeedAndAudio()

    if (media.mic) {
      const micTarget = (current - media.micOffsetMs) / 1000
      if (media.mic.paused && micTarget >= 0) void media.mic.play().catch(() => undefined)
      if (Math.abs(media.mic.currentTime - micTarget) > 0.25 && micTarget >= 0) {
        media.mic.currentTime = micTarget
      }
    }

    set({ playheadMs: current })
    loopFrame = requestAnimationFrame(tick)
  }

  const startLoop = (): void => {
    if (loopFrame === null) loopFrame = requestAnimationFrame(tick)
  }

  return {
    key: null,
    project: null,
    media: null,
    status: 'idle',
    error: null,
    editor: createDefaultEditor(),
    past: [],
    future: [],
    saveStatus: 'saved',
    notice: null,
    playheadMs: 0,
    playing: false,
    frameVersion: 0,
    selection: null,
    selectedZoomId: null,
    pxPerSecond: 80,
    waveform: null,
    exportOpen: false,

    load: async (key) => {
      get().close()
      set({ key, status: 'loading', error: null })

      try {
        const project = await window.api.projects.get(key)
        const media = await ProjectMedia.load(key, project)
        if (get().key !== key) {
          media.dispose()
          return
        }

        set({
          project,
          media,
          status: 'ready',
          editor: project.editor,
          past: [],
          future: [],
          saveStatus: 'saved'
        })

        const micFile = project.tracks.microphone?.fileName
        if (micFile) {
          void loadWaveform(mediaUrl(key, micFile), WAVEFORM_BUCKETS).then((waveform) => {
            if (get().key === key) set({ waveform })
          })
        }

        await get().seek(0)
      } catch (error) {
        set({
          status: 'error',
          error: error instanceof Error ? error.message : 'Could not open this project'
        })
      }
    },

    close: () => {
      cancelFrame()
      if (saveTimer) {
        clearTimeout(saveTimer)
        saveTimer = null
      }
      get().media?.dispose()
      seekToken += 1
      lastCoalesce = null
      set({
        key: null,
        project: null,
        media: null,
        status: 'idle',
        error: null,
        editor: createDefaultEditor(),
        past: [],
        future: [],
        saveStatus: 'saved',
        notice: null,
        playheadMs: 0,
        playing: false,
        selection: null,
        selectedZoomId: null,
        waveform: null,
        exportOpen: false
      })
    },

    update: (next, coalesce) => {
      const state = get()
      const updated = next(state.editor)
      if (updated === state.editor) return

      const now = Date.now()
      const merge =
        coalesce !== undefined &&
        lastCoalesce !== null &&
        lastCoalesce.key === coalesce &&
        now - lastCoalesce.at < COALESCE_WINDOW_MS
      lastCoalesce = coalesce !== undefined ? { key: coalesce, at: now } : null

      set({
        editor: updated,
        past: merge ? state.past : [...state.past, state.editor].slice(-200),
        future: []
      })
      scheduleSave(get, set)
    },

    undo: () => {
      const { past, editor, future } = get()
      const previous = past[past.length - 1]
      if (!previous) return
      lastCoalesce = null
      set({ editor: previous, past: past.slice(0, -1), future: [editor, ...future] })
      scheduleSave(get, set)
    },

    redo: () => {
      const { past, editor, future } = get()
      const next = future[0]
      if (!next) return
      lastCoalesce = null
      set({ editor: next, future: future.slice(1), past: [...past, editor] })
      scheduleSave(get, set)
    },

    seek: async (ms) => {
      const { media } = get()
      if (!media) return
      const target = clampMs(ms, 0, media.durationMs)
      const token = ++seekToken
      set({ playheadMs: target })
      applySpeedAndAudio()

      await media.seekScreen(target)
      await media.seekWebcam(target)
      if (media.mic) media.mic.currentTime = Math.max(0, (target - media.micOffsetMs) / 1000)

      if (token === seekToken) set((state) => ({ frameVersion: state.frameVersion + 1 }))
    },

    togglePlay: () => {
      const { media, playing, playheadMs, editor } = get()
      if (!media) return

      if (playing) {
        media.screen.pause()
        media.mic?.pause()
        set({ playing: false })
        return
      }

      const segments = buildSegments(media.durationMs, editor)
      const end = segments[segments.length - 1]?.end ?? 0
      // Start from the beginning when the playhead is at the end of the edit.
      if (playheadMs >= end - 1) {
        void get().seek(segments[0]?.start ?? 0)
      }

      media.screen.currentTime = (get().playheadMs - media.screenOffsetMs) / 1000
      void media.screen.play().catch(() => undefined)
      set({ playing: true })
      startLoop()
    },

    setPxPerSecond: (value) => {
      set({ pxPerSecond: Math.min(Math.max(value, 10), 400) })
    },

    setSelection: (range) => {
      set({ selection: range, selectedZoomId: null })
    },

    setSelectedZoom: (id) => {
      set({ selectedZoomId: id, selection: null })
    },

    setExportOpen: (open) => {
      set({ exportOpen: open })
    },

    split: () => {
      const { playheadMs, media } = get()
      if (!media) return
      get().update((editor) => splitAt(editor, playheadMs))
    },

    deleteSelection: () => {
      const { selection } = get()
      if (!selection) return
      get().update((editor) => deleteRange(editor, selection))
      set({ selection: null })
    },

    restoreSelection: () => {
      const { selection } = get()
      if (!selection) return
      get().update((editor) => restoreRange(editor, selection))
    },

    restoreAll: () => {
      get().update((editor) => ({ ...editor, cuts: [] }))
    },

    trimToSelection: () => {
      const { selection } = get()
      if (!selection) return
      get().update((editor) => setTrim(editor, selection))
      set({ selection: null })
    },

    clearTrim: () => {
      get().update((editor) => setTrim(editor, null))
    },

    speedSelection: (speed) => {
      const { selection } = get()
      if (!selection) return
      get().update((editor) =>
        setSpeedRamp(editor, selection, speed, `ramp-${Date.now().toString(36)}`)
      )
    },

    removeRamp: (id) => {
      get().update((editor) => removeSpeedRamp(editor, id))
    },

    speedUpIdle: () => {
      const { media, editor } = get()
      if (!media) return

      const { moves, keys, hasCursor } = media.samples
      if (!hasCursor && keys.length === 0) {
        set({ notice: 'No input data was recorded, so idle time cannot be detected.' })
        return
      }

      const events: RecorderInputEvent[] = [
        ...moves.map((move) => ({ t: move.t, type: 'mousemove' as const })),
        ...keys.map((key) => ({ t: key.t, type: 'keydown' as const, keycode: key.keycode }))
      ].sort((a, b) => a.t - b.t)

      const idle = findIdleRanges(events, media.durationMs)
      if (idle.length === 0) {
        set({ notice: 'No idle stretches longer than two seconds were found.' })
        return
      }

      let next = editor
      idle.forEach((range, index) => {
        next = setSpeedRamp(next, range, IDLE_SPEED, `idle-${Date.now().toString(36)}-${index}`)
      })
      get().update(() => next)
      set({ notice: `Sped up ${idle.length} idle ${idle.length === 1 ? 'stretch' : 'stretches'}.` })
    },

    addZoomAtPlayhead: () => {
      const { media, playheadMs, editor } = get()
      if (!media) return
      const focus = media.samples.moves.length
        ? nearestPoint(playheadMs, media.samples.moves)
        : { x: 0.5, y: 0.5 }
      const segment: ZoomSegment = {
        id: `manual-${Date.now().toString(36)}`,
        start: Math.max(0, playheadMs),
        end: Math.min(media.durationMs, playheadMs + 2000),
        level: editor.zoom.level,
        focusX: focus.x,
        focusY: focus.y,
        source: 'manual'
      }
      get().update((current) => addZoomSegment(current, segment))
      set({ selectedZoomId: segment.id, selection: null })
    },

    detectZoom: () => {
      const { media, editor } = get()
      if (!media) return
      if (!media.samples.hasCursor) {
        set({
          notice: 'Cursor data is not available for this capture, so zoom cannot be detected.'
        })
        return
      }

      const detected = detectZoomSegments(media.samples.clicks, {
        sensitivity: editor.zoom.sensitivity,
        level: editor.zoom.level,
        durationMs: media.durationMs
      })

      get().update((current) => ({
        ...current,
        zoom: {
          ...current.zoom,
          segments: [
            ...current.zoom.segments.filter((segment) => segment.source === 'manual'),
            ...detected
          ].sort((a, b) => a.start - b.start)
        }
      }))
      set({
        notice: `Found ${detected.length} zoom ${detected.length === 1 ? 'segment' : 'segments'}.`
      })
    },

    updateZoom: (id, patch) => {
      get().update((editor) => updateZoomSegment(editor, id, patch), `zoom-${id}`)
    },

    removeZoom: (id) => {
      get().update((editor) => removeZoomSegment(editor, id))
      set({ selectedZoomId: null })
    },

    renameProject: async (name) => {
      const { key } = get()
      if (!key) return
      await window.api.projects.rename(key, name)
      const project = get().project
      if (project) set({ project: { ...project, name: name.trim() } })
    },

    clearNotice: () => {
      set({ notice: null })
    }
  }
})

const nearestPoint = (timelineMs: number, moves: PointSample[]): { x: number; y: number } => {
  let best = moves[0]
  for (const move of moves) {
    if (!best || Math.abs(move.t - timelineMs) < Math.abs(best.t - timelineMs)) best = move
    if (move.t > timelineMs) break
  }
  return best ? { x: best.x, y: best.y } : { x: 0.5, y: 0.5 }
}

/** Duration of the current edit, in output milliseconds. */
export const selectOutputDuration = (state: EditorStore): number => {
  if (!state.media) return 0
  return outputDurationMs(buildSegments(state.media.durationMs, state.editor))
}

export type { Segment }
