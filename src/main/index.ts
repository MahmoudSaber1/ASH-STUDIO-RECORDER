import { app } from 'electron'
import { installFileLogger } from '@main/logger'
import { registerMediaProtocol, registerMediaScheme } from '@main/media/protocol'
import { loadSettings } from '@main/settings'
import { installTray } from '@main/tray'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { IPC_EVENTS } from '@shared/ipc'
import { registerIpcHandlers } from '@main/ipc'
import { recorderManager } from '@main/recorder/manager'
import { unregisterAllShortcuts } from '@main/shortcuts'
import {
  createMainWindow,
  getMainWindow,
  markAppQuitting,
  prepareRecorderToolbar,
  setRecordingGuard
} from '@main/window'

/** Upper bound for saving an active recording before the app exits anyway. */
const QUIT_SAVE_TIMEOUT_MS = 10_000

let quitAfterSave = false

// Custom schemes must be declared before the app is ready.
registerMediaScheme()

const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const mainWindow = getMainWindow()
    if (!mainWindow) return

    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })

  void app.whenReady().then(() => {
    installFileLogger()
    registerMediaProtocol()
    void loadSettings()
    electronApp.setAppUserModelId('com.ashstudio.recorder')

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    registerIpcHandlers()
    // While a session exists, closing the window only hides it: the capture
    // lives in that renderer and would be lost if it were destroyed.
    setRecordingGuard(() => recorderManager.isRecording())

    const mainWindow = createMainWindow()
    mainWindow.on('closed', () => {
      // The hidden toolbar window keeps the app alive otherwise; on Windows and
      // Linux closing the recorder window should quit.
      if (process.platform !== 'darwin') app.quit()
    })
    prepareRecorderToolbar()
    installTray()
    void recorderManager.recoverInterruptedSessions()

    recorderManager.setStartShortcut(() => {
      const mainWindow = getMainWindow()
      if (!mainWindow || mainWindow.isDestroyed()) return

      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
      mainWindow.webContents.send(IPC_EVENTS.recorderStartShortcut)
    })

    app.on('activate', () => {
      if (!getMainWindow()) createMainWindow()
    })
  })
}

app.on('before-quit', (event) => {
  if (recorderManager.isRecording() && !quitAfterSave) {
    // Save the recording through the capture window first, then quit.
    event.preventDefault()
    quitAfterSave = true
    recorderManager.stop()
    void recorderManager.waitForRecordingEnd(QUIT_SAVE_TIMEOUT_MS).then(() => {
      app.quit()
    })
    return
  }

  markAppQuitting()
  recorderManager.shutdown()
  unregisterAllShortcuts()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
