import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { registerIpcHandlers } from '@main/ipc'
import { createMainWindow } from '@main/window'

const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const [mainWindow] = BrowserWindow.getAllWindows()
    if (!mainWindow) return

    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  void app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.ashstudio.recorder')

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    registerIpcHandlers()
    createMainWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
