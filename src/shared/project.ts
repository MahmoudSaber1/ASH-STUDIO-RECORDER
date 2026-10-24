import type { CaptureTarget, RecorderOptions, RecorderTrack } from './recorder'

/** File name of the project manifest inside each project folder. */
export const PROJECT_FILE_NAME = 'project.json'

/** Current on-disk schema. Bump it and add a step to `migrateProject` for every change. */
export const PROJECT_SCHEMA_VERSION = 2

export type AspectPreset = 'original' | '16:9' | '9:16' | '1:1' | '4:3'

export interface TimeRange {
  /** Source time in milliseconds on the recording clock. */
  start: number
  end: number
}

export interface SpeedRamp extends TimeRange {
  id: string
  /** Playback multiplier for this source range, 0.25 to 8. */
  speed: number
}

export interface ZoomSegment extends TimeRange {
  id: string
  /** Zoom factor at the peak of the segment, 1.1 to 4. */
  level: number
  /** Focus point in normalized screen coordinates, 0 to 1. */
  focusX: number
  focusY: number
  source: 'auto' | 'manual'
}

export type Background =
  { kind: 'solid'; color: string } | { kind: 'gradient'; from: string; to: string; angle: number }

export type FaceCamShape = 'circle' | 'rounded' | 'rect'
export type FaceCamAnchor = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'

export interface EditorState {
  /** Source range kept after trimming. `null` keeps the whole recording. */
  trim: TimeRange | null
  /** Source ranges removed by split and delete. */
  cuts: TimeRange[]
  speedRamps: SpeedRamp[]
  zoom: {
    auto: boolean
    /** 0 means only strong clicks trigger zoom; 1 means every click does. */
    sensitivity: number
    /** Default zoom level for automatic segments. */
    level: number
    segments: ZoomSegment[]
  }
  cursor: {
    visible: boolean
    /** Cursor scale relative to the recorded frame, 0.5 to 3. */
    size: number
    /** 0 is raw; 1 is the most smoothed path. */
    smoothing: number
    clickRipples: boolean
    highlight: boolean
  }
  keystrokes: boolean
  background: Background
  frame: {
    aspect: AspectPreset
    /** Padding around the recording as a fraction of the output width, 0 to 0.2. */
    padding: number
    /** Corner radius as a fraction of the output height, 0 to 0.1. */
    radius: number
    /** Shadow strength, 0 to 1. */
    shadow: number
  }
  faceCam: {
    enabled: boolean
    shape: FaceCamShape
    /** Width of the face cam as a fraction of the output width, 0.08 to 0.35. */
    size: number
    anchor: FaceCamAnchor
    mirror: boolean
    border: boolean
    hideDuringZoom: boolean
  }
  audio: {
    /** Linear gain, 0 to 2. */
    micVolume: number
    systemVolume: number
    fadeInMs: number
    fadeOutMs: number
  }
}

export interface ProjectMediaFile {
  fileName: string
  bytes: number
  startedAt: number
}

export interface ProjectFile {
  schemaVersion: typeof PROJECT_SCHEMA_VERSION
  id: string
  name: string
  createdAt: string
  updatedAt: string
  app: { name: string; version: string }
  status: 'recording' | 'completed' | 'incomplete' | 'error'
  target: CaptureTarget
  options: RecorderOptions
  timing: {
    /** Unix epoch in ms when the session began. */
    epoch: number
    startedAt: number
    endedAt: number | null
    pausedTotalMs: number
    clock: 'active'
  }
  mediaStartedAt: Partial<Record<RecorderTrack, number>>
  tracks: Partial<Record<RecorderTrack, ProjectMediaFile>>
  events: { fileName: string; count: number }
  notes: string[]
  editor: EditorState
}

export const createDefaultEditor = (): EditorState => ({
  trim: null,
  cuts: [],
  speedRamps: [],
  zoom: { auto: true, sensitivity: 0.5, level: 1.6, segments: [] },
  cursor: { visible: true, size: 1.4, smoothing: 0.5, clickRipples: true, highlight: false },
  keystrokes: false,
  background: { kind: 'gradient', from: '#1b1b2f', to: '#4c3fb3', angle: 135 },
  frame: { aspect: 'original', padding: 0.06, radius: 0.02, shadow: 0.5 },
  faceCam: {
    enabled: false,
    shape: 'circle',
    size: 0.18,
    anchor: 'bottom-right',
    mirror: true,
    border: true,
    hideDuringZoom: false
  },
  audio: { micVolume: 1, systemVolume: 1, fadeInMs: 0, fadeOutMs: 0 }
})

type Unknown = Record<string, unknown>

const isRecord = (value: unknown): value is Unknown =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const num = (value: unknown, min: number, max: number, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(Math.max(value, min), max)
}

const bool = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback

const oneOf = <T extends string>(value: unknown, options: readonly T[], fallback: T): T =>
  (options as readonly string[]).includes(value as string) ? (value as T) : fallback

const hexColor = (value: unknown, fallback: string): string =>
  typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback

const text = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback

const idOf = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.length > 0 && value.length <= 64 ? value : fallback

const list = <T>(value: unknown, read: (item: unknown) => T | null): T[] => {
  if (!Array.isArray(value)) return []
  const out: T[] = []
  for (const item of value) {
    const parsed = read(item)
    if (parsed) out.push(parsed)
  }
  return out
}

const readRange = (value: unknown): TimeRange | null => {
  if (!isRecord(value)) return null
  const start = num(value.start, 0, Number.MAX_SAFE_INTEGER, NaN)
  const end = num(value.end, 0, Number.MAX_SAFE_INTEGER, NaN)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null
  return { start, end }
}

const readSpeedRamp = (value: unknown): SpeedRamp | null => {
  const range = readRange(value)
  if (!range || !isRecord(value)) return null
  return {
    ...range,
    id: idOf(value.id, `ramp-${range.start}`),
    speed: num(value.speed, 0.25, 8, 1)
  }
}

const readZoomSegment = (value: unknown): ZoomSegment | null => {
  const range = readRange(value)
  if (!range || !isRecord(value)) return null
  return {
    ...range,
    id: idOf(value.id, `zoom-${range.start}`),
    level: num(value.level, 1.1, 4, 1.6),
    focusX: num(value.focusX, 0, 1, 0.5),
    focusY: num(value.focusY, 0, 1, 0.5),
    source: value.source === 'manual' ? 'manual' : 'auto'
  }
}

const readBackground = (value: unknown, fallback: Background): Background => {
  if (!isRecord(value)) return fallback
  if (value.kind === 'solid') {
    return { kind: 'solid', color: hexColor(value.color, '#1b1b2f') }
  }
  if (value.kind === 'gradient') {
    return {
      kind: 'gradient',
      from: hexColor(value.from, '#1b1b2f'),
      to: hexColor(value.to, '#4c3fb3'),
      angle: num(value.angle, 0, 360, 135)
    }
  }
  return fallback
}

/**
 * Turns any editor payload, including partial or hand-edited ones, into a
 * valid `EditorState`. Unknown fields are dropped and out-of-range numbers are
 * clamped. This is the only way editor data should enter the app.
 */
export const normalizeEditor = (input: unknown): EditorState => {
  const base = createDefaultEditor()
  if (!isRecord(input)) return base

  const trim = readRange(input.trim)
  const zoom = isRecord(input.zoom) ? input.zoom : {}
  const cursor = isRecord(input.cursor) ? input.cursor : {}
  const frame = isRecord(input.frame) ? input.frame : {}
  const faceCam = isRecord(input.faceCam) ? input.faceCam : {}
  const audio = isRecord(input.audio) ? input.audio : {}

  return {
    trim,
    cuts: list(input.cuts, readRange),
    speedRamps: list(input.speedRamps, readSpeedRamp),
    zoom: {
      auto: bool(zoom.auto, base.zoom.auto),
      sensitivity: num(zoom.sensitivity, 0, 1, base.zoom.sensitivity),
      level: num(zoom.level, 1.1, 4, base.zoom.level),
      segments: list(zoom.segments, readZoomSegment)
    },
    cursor: {
      visible: bool(cursor.visible, base.cursor.visible),
      size: num(cursor.size, 0.5, 3, base.cursor.size),
      smoothing: num(cursor.smoothing, 0, 1, base.cursor.smoothing),
      clickRipples: bool(cursor.clickRipples, base.cursor.clickRipples),
      highlight: bool(cursor.highlight, base.cursor.highlight)
    },
    keystrokes: bool(input.keystrokes, base.keystrokes),
    background: readBackground(input.background, base.background),
    frame: {
      aspect: oneOf(frame.aspect, ['original', '16:9', '9:16', '1:1', '4:3'], 'original'),
      padding: num(frame.padding, 0, 0.2, base.frame.padding),
      radius: num(frame.radius, 0, 0.1, base.frame.radius),
      shadow: num(frame.shadow, 0, 1, base.frame.shadow)
    },
    faceCam: {
      enabled: bool(faceCam.enabled, base.faceCam.enabled),
      shape: oneOf(faceCam.shape, ['circle', 'rounded', 'rect'], base.faceCam.shape),
      size: num(faceCam.size, 0.08, 0.35, base.faceCam.size),
      anchor: oneOf(
        faceCam.anchor,
        ['bottom-left', 'bottom-right', 'top-left', 'top-right'],
        base.faceCam.anchor
      ),
      mirror: bool(faceCam.mirror, base.faceCam.mirror),
      border: bool(faceCam.border, base.faceCam.border),
      hideDuringZoom: bool(faceCam.hideDuringZoom, base.faceCam.hideDuringZoom)
    },
    audio: {
      micVolume: num(audio.micVolume, 0, 2, base.audio.micVolume),
      systemVolume: num(audio.systemVolume, 0, 2, base.audio.systemVolume),
      fadeInMs: num(audio.fadeInMs, 0, 10_000, base.audio.fadeInMs),
      fadeOutMs: num(audio.fadeOutMs, 0, 10_000, base.audio.fadeOutMs)
    }
  }
}

/** Schema v1 was the recorder's first manifest: no id, name, or editor state. */
const migrateV1 = (raw: Unknown, newId: () => string): Unknown => {
  const target = isRecord(raw.target) ? raw.target : {}
  return {
    ...raw,
    schemaVersion: 2,
    id: idOf(raw.id, newId()),
    name: typeof target.name === 'string' && target.name ? target.name : 'Untitled recording',
    editor: createDefaultEditor()
  }
}

/**
 * Brings any stored project up to the current schema. Each step only knows how
 * to move one version forward, so old projects keep opening after changes.
 */
export const migrateProject = (raw: unknown, newId: () => string): Unknown => {
  if (!isRecord(raw)) throw new Error('Project file is not a JSON object')

  let current: Unknown = raw
  const version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 1

  if (version > PROJECT_SCHEMA_VERSION) {
    throw new Error(
      `This project was created by a newer version of the app (schema ${version}). Update Ash Studio Recorder to open it.`
    )
  }

  if (version < 2) current = migrateV1(current, newId)

  return current
}

/**
 * Validates the minimum a project needs to open and returns a typed value with
 * the editor normalized. Throws a readable error for anything unusable.
 */
export const parseProject = (raw: unknown, newId: () => string): ProjectFile => {
  const migrated = migrateProject(raw, newId)

  const target = isRecord(migrated.target) ? migrated.target : null
  const timing = isRecord(migrated.timing) ? migrated.timing : null
  if (!target || typeof target.id !== 'string' || typeof target.kind !== 'string') {
    throw new Error('Project is missing its capture target')
  }
  if (!timing || typeof timing.epoch !== 'number') {
    throw new Error('Project is missing its timing data')
  }

  const status = oneOf(
    migrated.status,
    ['recording', 'completed', 'incomplete', 'error'],
    'incomplete'
  )

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: idOf(migrated.id, newId()),
    name:
      typeof migrated.name === 'string' && migrated.name.trim() ? migrated.name.trim() : 'Untitled',
    createdAt:
      typeof migrated.createdAt === 'string' ? migrated.createdAt : new Date(0).toISOString(),
    updatedAt:
      typeof migrated.updatedAt === 'string' ? migrated.updatedAt : new Date(0).toISOString(),
    app: isRecord(migrated.app)
      ? {
          name: text(migrated.app.name, 'Ash Studio Recorder'),
          version: text(migrated.app.version, '0.0.0')
        }
      : { name: 'Ash Studio Recorder', version: '0.0.0' },
    status,
    target: target as unknown as ProjectFile['target'],
    options: (isRecord(migrated.options)
      ? migrated.options
      : {}) as unknown as ProjectFile['options'],
    timing: {
      epoch: num(timing.epoch, 0, Number.MAX_SAFE_INTEGER, 0),
      startedAt: num(timing.startedAt, 0, Number.MAX_SAFE_INTEGER, 0),
      endedAt: typeof timing.endedAt === 'number' ? timing.endedAt : null,
      pausedTotalMs: num(timing.pausedTotalMs, 0, Number.MAX_SAFE_INTEGER, 0),
      clock: 'active'
    },
    mediaStartedAt: isRecord(migrated.mediaStartedAt) ? migrated.mediaStartedAt : {},
    tracks: isRecord(migrated.tracks) ? migrated.tracks : {},
    events: isRecord(migrated.events)
      ? {
          fileName: text(migrated.events.fileName, 'events.jsonl'),
          count: num(migrated.events.count, 0, Number.MAX_SAFE_INTEGER, 0)
        }
      : { fileName: 'events.jsonl', count: 0 },
    notes: Array.isArray(migrated.notes)
      ? migrated.notes.filter((note): note is string => typeof note === 'string')
      : [],
    editor: normalizeEditor(migrated.editor)
  }
}

/** Total recorded duration in ms, from the screen track when present. */
export const projectDurationMs = (project: ProjectFile): number => {
  const end = project.timing.endedAt ?? project.timing.epoch
  const active = Math.max(0, end - project.timing.epoch - project.timing.pausedTotalMs)
  return active
}

/** One row in the projects library. Errors are kept so broken projects still show up. */
export interface ProjectSummary {
  /** Folder name. Stable on disk and used as the identifier in IPC. */
  key: string
  id: string | null
  name: string
  createdAt: string | null
  updatedAt: string | null
  durationMs: number
  status: ProjectFile['status'] | null
  hasThumbnail: boolean
  error: string | null
}
