import { execFile } from 'node:child_process'
import { app, BrowserWindow, dialog, shell } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc'
import {
  deleteProjectToTrash,
  duplicateProject,
  exportProject,
  importBackgroundImage,
  importProject,
  listProjects,
  readProject,
  readThumbnailDataUrl,
  renameProject,
  saveEditor,
  saveThumbnail
} from '@main/projects/store'
import { getRecordingsRoot } from '@main/recorder/paths'
import { join } from 'node:path'
import { handleIpc } from './handle'

const focusedWindow = (): BrowserWindow | undefined => BrowserWindow.getFocusedWindow() ?? undefined

/** macOS ships `sips`, which decodes HEIC and TIFF wallpapers into JPEG. */
const convertWithSips =
  process.platform === 'darwin'
    ? (source: string, target: string): Promise<void> =>
        new Promise((resolve, reject) => {
          execFile('sips', ['-s', 'format', 'jpeg', source, '--out', target], (error) => {
            if (error) reject(new Error('Could not convert this image'))
            else resolve()
          })
        })
    : null

export function registerProjectHandlers(): void {
  handleIpc(IPC_CHANNELS.projectsList, () => listProjects(getRecordingsRoot()))

  handleIpc(IPC_CHANNELS.projectGet, (key) => readProject(getRecordingsRoot(), key))

  handleIpc(IPC_CHANNELS.projectRename, (key, name) =>
    renameProject(getRecordingsRoot(), key, name)
  )

  handleIpc(IPC_CHANNELS.projectDuplicate, (key) => duplicateProject(getRecordingsRoot(), key))

  handleIpc(IPC_CHANNELS.projectDelete, (key) =>
    deleteProjectToTrash(getRecordingsRoot(), key, (path) => shell.trashItem(path))
  )

  handleIpc(IPC_CHANNELS.projectSaveEditor, (key, editor) =>
    saveEditor(getRecordingsRoot(), key, editor)
  )

  handleIpc(IPC_CHANNELS.projectSaveThumbnail, (key, data) =>
    saveThumbnail(getRecordingsRoot(), key, data)
  )

  handleIpc(IPC_CHANNELS.projectGetThumbnail, (key) =>
    readThumbnailDataUrl(getRecordingsRoot(), key)
  )

  handleIpc(IPC_CHANNELS.projectImport, async () => {
    const result = await dialog.showOpenDialog(focusedWindow() ?? ({} as BrowserWindow), {
      title: 'Import project folder',
      properties: ['openDirectory']
    })
    const source = result.filePaths[0]
    if (result.canceled || !source) return null
    return importProject(getRecordingsRoot(), source)
  })

  handleIpc(IPC_CHANNELS.projectExport, async (key) => {
    const result = await dialog.showOpenDialog(focusedWindow() ?? ({} as BrowserWindow), {
      title: 'Choose where to export the project',
      properties: ['openDirectory', 'createDirectory']
    })
    const destination = result.filePaths[0]
    if (result.canceled || !destination) return null
    return exportProject(getRecordingsRoot(), key, destination)
  })

  handleIpc(IPC_CHANNELS.projectImportBackground, async (key) => {
    const defaultPath =
      process.platform === 'darwin'
        ? '/System/Library/Desktop Pictures'
        : process.platform === 'win32'
          ? 'C:\\Windows\\Web\\Wallpaper'
          : app.getPath('pictures')
    const result = await dialog.showOpenDialog(focusedWindow() ?? ({} as BrowserWindow), {
      title: 'Choose a background image',
      defaultPath,
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'heic', 'tif', 'tiff'] }
      ]
    })
    const source = result.filePaths[0]
    if (result.canceled || !source) return null
    return importBackgroundImage(getRecordingsRoot(), key, source, convertWithSips)
  })

  handleIpc(IPC_CHANNELS.projectReveal, async (key) => {
    const error = await shell.openPath(join(getRecordingsRoot(), key))
    return error === ''
  })
}
