import { ipcMain } from 'electron'
import type { IpcChannel, IpcContract } from '@shared/ipc'

type Handler<K extends IpcChannel> = (
  ...args: IpcContract[K]['args']
) => IpcContract[K]['result'] | Promise<IpcContract[K]['result']>

export const handleIpc = <K extends IpcChannel>(channel: K, handler: Handler<K>): void => {
  ipcMain.handle(channel, (_event, ...args: unknown[]) =>
    handler(...(args as IpcContract[K]['args']))
  )
}
