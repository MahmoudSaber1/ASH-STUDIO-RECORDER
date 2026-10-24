import type { CaptureSourceKind } from './platform'

export const RECORDER_TRACKS = ['screen', 'webcam', 'microphone', 'systemAudio'] as const

export type RecorderTrack = (typeof RECORDER_TRACKS)[number]

export const RECORDER_PHASES = [
  'idle',
  'recording',
  'paused',
  'stopping',
  'completed',
  'error'
] as const

export type RecorderPhase = (typeof RECORDER_PHASES)[number]

export interface CaptureTarget {
  id: string
  name: string
  kind: CaptureSourceKind
  displayId?: string
}

export interface RecorderOptions {
  fps: 30 | 60
  captureWebcam: boolean
  captureMicrophone: boolean
  captureSystemAudio: boolean
  countdownMs: number
  logKeys: boolean
}

export interface RecorderStartRequest {
  target: CaptureTarget
  options: RecorderOptions
}

export type InputTrackingStatus = 'inactive' | 'active' | 'unavailable'

export interface RecorderState {
  phase: RecorderPhase
  sessionId: string | null
  startedAt: number | null
  elapsedMs: number
  target: CaptureTarget | null
  projectDir: string | null
  activeTracks: RecorderTrack[]
  inputTracking: InputTrackingStatus
  error: string | null
  /** Non-fatal problems the user should see, such as missing permissions. */
  warnings: string[]
}

export const DEFAULT_RECORDER_OPTIONS: RecorderOptions = {
  fps: 30,
  captureWebcam: false,
  captureMicrophone: false,
  captureSystemAudio: false,
  countdownMs: 3000,
  logKeys: false
}

export type InputEventType = 'mousemove' | 'mousedown' | 'mouseup' | 'wheel' | 'keydown' | 'keyup'

export interface RecorderInputEvent {
  /** Milliseconds on the active recording clock. */
  t: number
  type: InputEventType
  x?: number
  y?: number
  button?: number
  clicks?: number
  keycode?: number
  direction?: number
  rotation?: number
}

export const isRecorderTrack = (value: unknown): value is RecorderTrack =>
  typeof value === 'string' && (RECORDER_TRACKS as readonly string[]).includes(value)
