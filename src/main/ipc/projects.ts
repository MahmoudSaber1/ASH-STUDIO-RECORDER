import { BrowserWindow, dialog, shell } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc'
import {
  deleteProjectToTrash,
  duplicateProject,
  exportProject,
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

  handleIpc(IPC_CHANNELS.projectReveal, async (key) => {
    const error = await shell.openPath(join(getRecordingsRoot(), key))
    return error === ''
  })
}
