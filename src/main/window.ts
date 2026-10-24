import { join } from 'node:path'
import { BrowserWindow, shell } from 'electron'
import { is } from '@electron-toolkit/utils'

const isHttpUrl = (url: string): boolean => /^https?:\/\//i.test(url)

export function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 940,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'Ash Studio Recorder',
    backgroundColor: '#0b0b0f',
    ...(process.platform === 'darwin'
      ? {
          titleBarStyle: 'hiddenInset' as const,
          trafficLightPosition: { x: 16, y: 16 }
        }
      : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isHttpUrl(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const devRendererUrl = process.env['ELECTRON_RENDERER_URL']
    if (is.dev && devRendererUrl && url.startsWith(devRendererUrl)) return
    event.preventDefault()
  })

  const devRendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (is.dev && devRendererUrl) {
    void mainWindow.loadURL(devRendererUrl)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}
