import { app, Menu, nativeImage, Tray } from 'electron'
import { IPC_EVENTS } from '@shared/ipc'
import { recorderManager } from '@main/recorder/manager'
import { getMainWindow } from '@main/window'

/** 18×18 template-style dot. Replaced by the app icon once designed. */
const ICON_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAYAAABWzo5XAAAAWUlEQVR42mP4//8/AzUww5AyqASITwPxTyg+DRUj2iAlqCZc4DRUDUGD8BmCbBheg0r+Ew9K8Bl0mgSDTuMz6CcJBv2ki0FU8xrVAptq0U/VBEm1LDJMihEA2ZY4uQagCrkAAAAASUVORK5CYII='

let tray: Tray | null = null

const showMainWindow = (): void => {
  const window = getMainWindow()
  if (!window || window.isDestroyed()) return
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
}

const buildMenu = (): Menu => {
  const recording = recorderManager.isRecording()
  return Menu.buildFromTemplate([
    { label: 'Show Ash Studio Recorder', click: showMainWindow },
    { type: 'separator' },
    {
      label: 'Start recording',
      enabled: !recording,
      click: () => {
        showMainWindow()
        getMainWindow()?.webContents.send(IPC_EVENTS.recorderStartShortcut)
      }
    },
    {
      label: 'Stop recording',
      enabled: recording,
      click: () => {
        recorderManager.stop()
      }
    },
    { type: 'separator' },
    { label: 'Quit', role: 'quit' }
  ])
}

/** Menu bar (macOS) or notification area (Windows) entry for quick control. */
export const installTray = (): void => {
  if (tray) return

  const image = nativeImage.createFromBuffer(Buffer.from(ICON_BASE64, 'base64'))
  if (process.platform === 'darwin') image.setTemplateImage(true)

  tray = new Tray(image)
  tray.setToolTip('Ash Studio Recorder')
  tray.on('click', showMainWindow)
  tray.setContextMenu(buildMenu())

  // Keep the recording entries in sync when a session starts or ends.
  setInterval(() => {
    tray?.setContextMenu(buildMenu())
  }, 2000)

  app.on('before-quit', () => {
    tray?.destroy()
    tray = null
  })
}
