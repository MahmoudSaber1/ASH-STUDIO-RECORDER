import type {
  CaptureSource,
  CaptureSourcesOptions,
  PermissionKind,
  PermissionState,
  PlatformCapabilities,
  Point
} from '@shared/platform'

export interface PlatformService {
  readonly capabilities: PlatformCapabilities
  getPermissions: () => PermissionState[]
  requestPermission: (kind: PermissionKind) => Promise<PermissionState[]>
  openPermissionSettings: (kind: PermissionKind) => Promise<boolean>
  getSources: (options?: CaptureSourcesOptions) => Promise<CaptureSource[]>
  listWindows: () => Promise<CaptureSource[]>
  getCursorPosition: () => Point
}
