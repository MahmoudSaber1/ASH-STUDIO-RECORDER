import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  IPC_CHANNELS,
  IPC_EVENTS,
  type IpcChannel,
  type IpcContract,
  type RecorderState,
  type StudioApi
} from '@shared/ipc'

const invoke = <K extends IpcChannel>(
  channel: K,
  ...args: IpcContract[K]['args']
): Promise<IpcContract[K]['result']> =>
  ipcRenderer.invoke(channel, ...args) as Promise<IpcContract[K]['result']>

const subscribe = <T>(channel: string, listener: (payload: T) => void): (() => void) => {
  const handler = (_event: IpcRendererEvent, payload: T): void => listener(payload)
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.removeListener(channel, handler)
  }
}

const api: StudioApi = {
  exporter: {
    start: (settings) => invoke(IPC_CHANNELS.exportStart, settings),
    frame: (id, frame) => invoke(IPC_CHANNELS.exportFrame, id, frame),
    finish: (id) => invoke(IPC_CHANNELS.exportFinish, id),
    cancel: (id) => invoke(IPC_CHANNELS.exportCancel, id)
  },
  projects: {
    list: () => invoke(IPC_CHANNELS.projectsList),
    get: (key) => invoke(IPC_CHANNELS.projectGet, key),
    rename: (key, name) => invoke(IPC_CHANNELS.projectRename, key, name),
    duplicate: (key) => invoke(IPC_CHANNELS.projectDuplicate, key),
    remove: (key) => invoke(IPC_CHANNELS.projectDelete, key),
    saveEditor: (key, editor) => invoke(IPC_CHANNELS.projectSaveEditor, key, editor),
    saveThumbnail: (key, data) => invoke(IPC_CHANNELS.projectSaveThumbnail, key, data),
    getThumbnail: (key) => invoke(IPC_CHANNELS.projectGetThumbnail, key),
    import: () => invoke(IPC_CHANNELS.projectImport),
    export: (key) => invoke(IPC_CHANNELS.projectExport, key),
    reveal: (key) => invoke(IPC_CHANNELS.projectReveal, key)
  },
  app: {
    getInfo: () => invoke(IPC_CHANNELS.appGetInfo)
  },
  platform: {
    getCapabilities: () => invoke(IPC_CHANNELS.platformGetCapabilities),
    getPermissions: () => invoke(IPC_CHANNELS.platformGetPermissions),
    requestPermission: (kind) => invoke(IPC_CHANNELS.platformRequestPermission, kind),
    openPermissionSettings: (kind) => invoke(IPC_CHANNELS.platformOpenPermissionSettings, kind),
    getSources: (options) => invoke(IPC_CHANNELS.platformGetSources, options),
    listWindows: () => invoke(IPC_CHANNELS.platformListWindows),
    getCursorPosition: () => invoke(IPC_CHANNELS.platformGetCursorPosition)
  },
  recorder: {
    start: (request) => invoke(IPC_CHANNELS.recorderStart, request),
    trackStarted: (track, startedAt) => invoke(IPC_CHANNELS.recorderTrackStarted, track, startedAt),
    appendChunk: (track, chunk) => invoke(IPC_CHANNELS.recorderAppendChunk, track, chunk),
    pause: (at) => invoke(IPC_CHANNELS.recorderPause, at),
    resume: (at) => invoke(IPC_CHANNELS.recorderResume, at),
    stop: () => invoke(IPC_CHANNELS.recorderStop),
    stopComplete: () => invoke(IPC_CHANNELS.recorderStopComplete),
    getState: () => invoke(IPC_CHANNELS.recorderGetState),
    openProjectFolder: () => invoke(IPC_CHANNELS.recorderOpenProjectFolder),
    onState: (listener) => subscribe<RecorderState>(IPC_EVENTS.recorderState, listener),
    onStartShortcut: (listener) =>
      subscribe<void>(IPC_EVENTS.recorderStartShortcut, () => listener())
  }
}

try {
  contextBridge.exposeInMainWorld('api', api)
} catch (error) {
  console.error('[preload] failed to expose bridge', error)
}
