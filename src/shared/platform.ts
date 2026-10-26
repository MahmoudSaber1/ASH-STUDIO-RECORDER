export type AppPlatform = 'darwin' | 'win32' | 'linux' | 'other'

export const PERMISSION_KINDS = ['screen', 'accessibility', 'camera', 'microphone'] as const

export type PermissionKind = (typeof PERMISSION_KINDS)[number]

export type PermissionStatus =
  'granted' | 'denied' | 'restricted' | 'not-determined' | 'unknown' | 'unavailable'

export interface PermissionState {
  kind: PermissionKind
  status: PermissionStatus
  required: boolean
}

export interface PlatformCapabilities {
  platform: AppPlatform
  requiresScreenRecordingPermission: boolean
  requiresAccessibilityPermission: boolean
  supportsSystemAudioCapture: boolean
  supportsWindowCapture: boolean
  supportsGlobalInputHooks: boolean
}

export type CaptureSourceKind = 'screen' | 'window'

export interface CaptureSource {
  id: string
  name: string
  kind: CaptureSourceKind
  displayId?: string
  thumbnail?: string
  appIcon?: string
  /** Width divided by height of the source, so cards can show the real shape. */
  aspectRatio?: number
}

export interface CaptureSourcesOptions {
  kinds?: CaptureSourceKind[]
  thumbnails?: boolean
  thumbnailSize?: { width: number; height: number }
  fetchWindowIcons?: boolean
}

export interface Point {
  x: number
  y: number
}

export const isPermissionKind = (value: unknown): value is PermissionKind =>
  typeof value === 'string' && (PERMISSION_KINDS as readonly string[]).includes(value)

export const isCaptureSourceKind = (value: unknown): value is CaptureSourceKind =>
  value === 'screen' || value === 'window'
