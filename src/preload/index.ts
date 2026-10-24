import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, type IpcChannel, type IpcContract, type StudioApi } from '@shared/ipc'

const invoke = <K extends IpcChannel>(
  channel: K,
  ...args: IpcContract[K]['args']
): Promise<IpcContract[K]['result']> =>
  ipcRenderer.invoke(channel, ...args) as Promise<IpcContract[K]['result']>

const api: StudioApi = {
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
  }
}

try {
  contextBridge.exposeInMainWorld('api', api)
} catch (error) {
  console.error('[preload] failed to expose bridge', error)
}
