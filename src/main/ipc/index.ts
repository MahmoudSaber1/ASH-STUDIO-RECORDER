import { app } from 'electron'
import {
  DEFAULT_RECORDER_OPTIONS,
  IPC_CHANNELS,
  isCaptureSourceKind,
  isPermissionKind,
  isRecorderTrack,
  type AppInfo,
  type AppPlatform,
  type CaptureSourcesOptions,
  type CaptureTarget,
  type PermissionKind,
  type RecorderOptions,
  type RecorderStartRequest,
  type RecorderTrack
} from '@shared/ipc'
import { createPlatformService } from '@main/platform'
import { recorderManager } from '@main/recorder/manager'
import { registerProjectHandlers } from './projects'
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

const assertRecorderTrack = (value: unknown): RecorderTrack => {
  if (!isRecorderTrack(value)) {
    throw new Error(`Unsupported recording track: ${String(value)}`)
  }
  return value
}

const assertStartedAt = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Recording start timestamp must be a finite number')
  }
  return value
}

const assertChunk = (value: unknown): ArrayBuffer => {
  if (value instanceof ArrayBuffer) return value

  if (ArrayBuffer.isView(value)) {
    const copy = new Uint8Array(value.byteLength)
    copy.set(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))
    return copy.buffer
  }

  throw new Error('Invalid media chunk payload')
}

const normalizeOptionalTimestamp = (value: unknown): number | undefined => {
  if (value === undefined) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Recording timestamp must be a finite number')
  }
  return value
}

const normalizeCaptureTarget = (value: unknown): CaptureTarget => {
  if (!isRecord(value)) throw new Error('Invalid capture target')

  const id = typeof value.id === 'string' ? value.id.trim() : ''
  if (!id) throw new Error('Capture target id is required')
  if (!isCaptureSourceKind(value.kind)) throw new Error('Invalid capture target kind')

  const name =
    typeof value.name === 'string' && value.name.trim() ? value.name.trim() : 'Untitled capture'
  const displayId =
    typeof value.displayId === 'string' && value.displayId.trim()
      ? value.displayId.trim()
      : undefined

  return {
    id,
    name,
    kind: value.kind,
    ...(displayId ? { displayId } : {})
  }
}

const normalizeRecorderOptions = (value: unknown): RecorderOptions => {
  const options = isRecord(value) ? value : {}
  const fps: 30 | 60 = options.fps === 60 ? 60 : 30
  const countdownMs =
    typeof options.countdownMs === 'number' && Number.isFinite(options.countdownMs)
      ? Math.min(Math.max(Math.round(options.countdownMs), 0), 10000)
      : DEFAULT_RECORDER_OPTIONS.countdownMs

  return {
    fps,
    captureWebcam: options.captureWebcam === true,
    captureMicrophone: options.captureMicrophone === true,
    captureSystemAudio: options.captureSystemAudio === true,
    countdownMs,
    logKeys: options.logKeys === true
  }
}

const normalizeRecorderRequest = (value: unknown): RecorderStartRequest => {
  if (!isRecord(value)) throw new Error('Invalid recording request')

  return {
    target: normalizeCaptureTarget(value.target),
    options: normalizeRecorderOptions(value.options)
  }
}

export function registerIpcHandlers(): void {
  registerProjectHandlers()

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

  handleIpc(IPC_CHANNELS.recorderStart, (request) =>
    recorderManager.start(normalizeRecorderRequest(request))
  )

  handleIpc(IPC_CHANNELS.recorderTrackStarted, (track, startedAt) => {
    recorderManager.trackStarted(assertRecorderTrack(track), assertStartedAt(startedAt))
  })

  handleIpc(IPC_CHANNELS.recorderAppendChunk, (track, chunk) =>
    recorderManager.appendChunk(assertRecorderTrack(track), assertChunk(chunk))
  )

  handleIpc(IPC_CHANNELS.recorderPause, (at) =>
    recorderManager.pause(normalizeOptionalTimestamp(at))
  )
  handleIpc(IPC_CHANNELS.recorderResume, (at) =>
    recorderManager.resume(normalizeOptionalTimestamp(at))
  )
  handleIpc(IPC_CHANNELS.recorderStop, () => recorderManager.stop())
  handleIpc(IPC_CHANNELS.recorderStopComplete, () => recorderManager.stopComplete())
  handleIpc(IPC_CHANNELS.recorderGetState, () => recorderManager.getState())
  handleIpc(IPC_CHANNELS.recorderOpenProjectFolder, () => recorderManager.openProjectFolder())
}
