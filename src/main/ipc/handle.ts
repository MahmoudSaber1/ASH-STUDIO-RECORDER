import { ipcMain } from 'electron'
import type { IpcChannel, IpcContract } from '@shared/ipc'
import { isTrustedSender } from '@main/security'

type Handler<K extends IpcChannel> = (
  ...args: IpcContract[K]['args']
) => IpcContract[K]['result'] | Promise<IpcContract[K]['result']>

/**
 * Registers a typed handler. Calls from frames that are not the app's own pages
 * are rejected before they reach the handler.
 */
export const handleIpc = <K extends IpcChannel>(channel: K, handler: Handler<K>): void => {
  ipcMain.handle(channel, (event, ...args: unknown[]) => {
    if (!isTrustedSender(event.senderFrame)) {
      throw new Error(`Rejected ${channel} from an untrusted sender`)
    }
    return handler(...(args as IpcContract[K]['args']))
  })
}
