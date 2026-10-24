import type { AppInfo } from './app'
import type {
  CaptureSource,
  CaptureSourcesOptions,
  PermissionKind,
  PermissionState,
  PlatformCapabilities,
  Point
} from './platform'

export * from './app'
export * from './platform'

export const IPC_CHANNELS = {
  appGetInfo: 'app:get-info',
  platformGetCapabilities: 'platform:get-capabilities',
  platformGetPermissions: 'platform:get-permissions',
  platformRequestPermission: 'platform:request-permission',
  platformOpenPermissionSettings: 'platform:open-permission-settings',
  platformGetSources: 'platform:get-sources',
  platformListWindows: 'platform:list-windows',
  platformGetCursorPosition: 'platform:get-cursor-position'
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

export interface IpcContract {
  [IPC_CHANNELS.appGetInfo]: { args: []; result: AppInfo }
  [IPC_CHANNELS.platformGetCapabilities]: { args: []; result: PlatformCapabilities }
  [IPC_CHANNELS.platformGetPermissions]: { args: []; result: PermissionState[] }
  [IPC_CHANNELS.platformRequestPermission]: {
    args: [kind: PermissionKind]
    result: PermissionState[]
  }
  [IPC_CHANNELS.platformOpenPermissionSettings]: {
    args: [kind: PermissionKind]
    result: boolean
  }
  [IPC_CHANNELS.platformGetSources]: {
    args: [options?: CaptureSourcesOptions]
    result: CaptureSource[]
  }
  [IPC_CHANNELS.platformListWindows]: { args: []; result: CaptureSource[] }
  [IPC_CHANNELS.platformGetCursorPosition]: { args: []; result: Point }
}

/** Contract exposed to the renderer through the preload bridge. */
export interface StudioApi {
  app: {
    getInfo: () => Promise<AppInfo>
  }
  platform: {
    getCapabilities: () => Promise<PlatformCapabilities>
    getPermissions: () => Promise<PermissionState[]>
    requestPermission: (kind: PermissionKind) => Promise<PermissionState[]>
    openPermissionSettings: (kind: PermissionKind) => Promise<boolean>
    getSources: (options?: CaptureSourcesOptions) => Promise<CaptureSource[]>
    listWindows: () => Promise<CaptureSource[]>
    getCursorPosition: () => Promise<Point>
  }
}
