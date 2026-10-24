import { app } from 'electron'
import {
  IPC_CHANNELS,
  isCaptureSourceKind,
  isPermissionKind,
  type AppInfo,
  type AppPlatform,
  type CaptureSourcesOptions,
  type PermissionKind
} from '@shared/ipc'
import { createPlatformService } from '@main/platform'
import { handleIpc } from './handle'

const MAX_THUMBNAIL_DIMENSION = 1024

const platform = createPlatformService()

const toAppPlatform = (value: string): AppPlatform => {
  switch (value) {
    case 'darwin':
    case 'win32':
    case 'linux':
      return value
    default:
      return 'other'
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const assertPermissionKind = (value: unknown): PermissionKind => {
  if (!isPermissionKind(value)) {
    throw new Error(`Unsupported permission kind: ${String(value)}`)
  }
  return value
}

const normalizeDimension = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return Math.min(Math.max(Math.round(value), 0), MAX_THUMBNAIL_DIMENSION)
}

const normalizeSourcesOptions = (value: unknown): CaptureSourcesOptions => {
  if (!isRecord(value)) return {}

  const kinds = Array.isArray(value.kinds) ? value.kinds.filter(isCaptureSourceKind) : []
  const width = isRecord(value.thumbnailSize)
    ? normalizeDimension(value.thumbnailSize.width)
    : undefined
  const height = isRecord(value.thumbnailSize)
    ? normalizeDimension(value.thumbnailSize.height)
    : undefined
  const thumbnailSize = width !== undefined && height !== undefined ? { width, height } : undefined

  return {
    ...(kinds.length > 0 ? { kinds } : {}),
    ...(typeof value.thumbnails === 'boolean' ? { thumbnails: value.thumbnails } : {}),
    ...(typeof value.fetchWindowIcons === 'boolean'
      ? { fetchWindowIcons: value.fetchWindowIcons }
      : {}),
    ...(thumbnailSize ? { thumbnailSize } : {})
  }
}

export function registerIpcHandlers(): void {
  handleIpc(IPC_CHANNELS.appGetInfo, (): AppInfo => {
    return {
      name: app.getName(),
      version: app.getVersion(),
      platform: toAppPlatform(process.platform),
      arch: process.arch,
      isPackaged: app.isPackaged
    }
  })

  handleIpc(IPC_CHANNELS.platformGetCapabilities, () => platform.capabilities)

  handleIpc(IPC_CHANNELS.platformGetPermissions, () => platform.getPermissions())

  handleIpc(IPC_CHANNELS.platformRequestPermission, (kind) =>
    platform.requestPermission(assertPermissionKind(kind))
  )

  handleIpc(IPC_CHANNELS.platformOpenPermissionSettings, (kind) =>
    platform.openPermissionSettings(assertPermissionKind(kind))
  )

  handleIpc(IPC_CHANNELS.platformGetSources, (options) =>
    platform.getSources(normalizeSourcesOptions(options))
  )

  handleIpc(IPC_CHANNELS.platformListWindows, () => platform.listWindows())

  handleIpc(IPC_CHANNELS.platformGetCursorPosition, () => platform.getCursorPosition())
}
