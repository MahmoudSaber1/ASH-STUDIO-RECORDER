import { app, BrowserWindow, dialog, shell } from 'electron'
import { join } from 'node:path'
import { IPC_CHANNELS } from '@shared/ipc'
import type { SettingsInfo } from '@shared/settings'
import { getRecordingsRoot } from '@main/recorder/paths'
import { loadSettings, saveSettings } from '@main/settings'
import { handleIpc } from './handle'

const info = async (): Promise<SettingsInfo> => ({
  settings: await loadSettings(),
  effectiveRecordingsFolder: getRecordingsRoot(),
  logFile: join(app.getPath('logs'), 'main.log')
})

export function registerSettingsHandlers(): void {
  handleIpc(IPC_CHANNELS.settingsGet, () => info())

  handleIpc(IPC_CHANNELS.settingsChooseRecordingsFolder, async () => {
    const parent = BrowserWindow.getFocusedWindow() ?? undefined
    const result = await dialog.showOpenDialog(parent ?? ({} as BrowserWindow), {
      title: 'Choose where recordings are saved',
      properties: ['openDirectory', 'createDirectory']
    })
    const folder = result.filePaths[0]
    if (result.canceled || !folder) return null

    await saveSettings({ ...(await loadSettings()), recordingsFolder: folder })
    return info()
  })

  handleIpc(IPC_CHANNELS.settingsResetRecordingsFolder, async () => {
    await saveSettings({ ...(await loadSettings()), recordingsFolder: null })
    return info()
  })

  handleIpc(IPC_CHANNELS.settingsOpenLogs, async () => {
    const error = await shell.openPath(app.getPath('logs'))
    return error === ''
  })
}
