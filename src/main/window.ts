import { join } from 'node:path'
import { BrowserWindow, screen, shell } from 'electron'
import { is } from '@electron-toolkit/utils'

const isHttpUrl = (url: string): boolean => /^https?:\/\//i.test(url)

const TOOLBAR_WIDTH = 320
const TOOLBAR_HEIGHT = 64

let mainWindow: BrowserWindow | null = null
let toolbarWindow: BrowserWindow | null = null
let isQuitting = false
let keepWindowsAliveWhileRecording: () => boolean = () => false

/** Called only once a quit is really going ahead, never while a save is pending. */
export function markAppQuitting(): void {
  isQuitting = true
}

/** Lets the recorder stop the capture window from being destroyed mid-recording. */
export function setRecordingGuard(guard: () => boolean): void {
  keepWindowsAliveWhileRecording = guard
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
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
      sandbox: false,
      // Minimizing the window during a recording must not slow down the
      // countdown or the MediaRecorder timeslices.
      backgroundThrottling: false
    }
  })

  mainWindow = window

  window.on('ready-to-show', () => {
    window.show()
  })

  window.on('close', (event) => {
    if (isQuitting || !keepWindowsAliveWhileRecording()) return
    event.preventDefault()
    window.hide()
  })

  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isHttpUrl(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event, url) => {
    const devRendererUrl = process.env['ELECTRON_RENDERER_URL']
    if (is.dev && devRendererUrl && url.startsWith(devRendererUrl)) return
    event.preventDefault()
  })

  const devRendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (is.dev && devRendererUrl) {
    void window.loadURL(devRendererUrl)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

function createToolbarWindow(): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay()
  const x = Math.round(workArea.x + (workArea.width - TOOLBAR_WIDTH) / 2)
  const y = workArea.y + 16

  const window = new BrowserWindow({
    width: TOOLBAR_WIDTH,
    height: TOOLBAR_HEIGHT,
    x,
    y,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // Keep the floating controls out of the capture on every OS we support.
  window.setContentProtection(true)
  window.setAlwaysOnTop(true, 'screen-saver')
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  window.on('close', (event) => {
    if (isQuitting) return
    event.preventDefault()
    window.hide()
  })

  window.on('closed', () => {
    if (toolbarWindow === window) toolbarWindow = null
  })

  const devRendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (is.dev && devRendererUrl) {
    void window.loadURL(`${devRendererUrl}#toolbar`)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'toolbar' })
  }

  return window
}

/** Create the toolbar ahead of time so showing it during a start is instant. */
export function prepareRecorderToolbar(): void {
  if (toolbarWindow && !toolbarWindow.isDestroyed()) return
  toolbarWindow = createToolbarWindow()
}

export function showRecorderToolbar(): void {
  prepareRecorderToolbar()
  if (!toolbarWindow) return
  toolbarWindow.setAlwaysOnTop(true, 'screen-saver')
  toolbarWindow.showInactive()
}

export function hideRecorderToolbar(): void {
  if (!toolbarWindow || toolbarWindow.isDestroyed()) return
  toolbarWindow.hide()
}

export function minimizeMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.minimize()
}

export function restoreMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

const CAMERA_BUBBLE_SIZE = 200

let cameraWindow: BrowserWindow | null = null

/**
 * Floating camera preview shown while recording, so the speaker can see
 * themselves. Content protection keeps it out of the screen capture: the camera
 * is recorded as its own track and placed in the editor, never baked in.
 * The window is destroyed afterwards so the camera light turns off.
 */
export function showCameraBubble(): void {
  if (cameraWindow && !cameraWindow.isDestroyed()) {
    cameraWindow.showInactive()
    return
  }

  const { workArea } = screen.getPrimaryDisplay()
  const margin = 24
  const window = new BrowserWindow({
    width: CAMERA_BUBBLE_SIZE,
    height: CAMERA_BUBBLE_SIZE,
    x: workArea.x + workArea.width - CAMERA_BUBBLE_SIZE - margin,
    y: workArea.y + workArea.height - CAMERA_BUBBLE_SIZE - margin,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    focusable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  window.setContentProtection(true)
  window.setAlwaysOnTop(true, 'screen-saver')
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  window.once('ready-to-show', () => {
    window.showInactive()
  })
  window.on('closed', () => {
    if (cameraWindow === window) cameraWindow = null
  })

  const devRendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (is.dev && devRendererUrl) {
    void window.loadURL(`${devRendererUrl}#camera`)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'camera' })
  }

  cameraWindow = window
}

export function hideCameraBubble(): void {
  if (!cameraWindow || cameraWindow.isDestroyed()) return
  cameraWindow.destroy()
  cameraWindow = null
}
