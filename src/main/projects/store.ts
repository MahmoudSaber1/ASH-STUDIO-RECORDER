import { randomUUID } from 'node:crypto'
import { cp, mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import {
  normalizeEditor,
  parseProject,
  PROJECT_FILE_NAME,
  PROJECT_SCHEMA_VERSION,
  projectDurationMs,
  type EditorState,
  type ProjectFile,
  type ProjectSummary
} from '@shared/project'

/**
 * File-system operations for projects. Pure Node: no Electron imports, so the
 * whole module can be tested against a temporary folder. Callers pass the
 * recordings root.
 */

export const THUMBNAIL_FILE = 'thumbnail.jpg'

export class ProjectError extends Error {}

/** Keys are plain folder names. Anything that could escape the root is rejected. */
export const assertValidKey = (key: string): void => {
  if (!key || key.includes('/') || key.includes('\\') || key === '.' || key === '..') {
    throw new ProjectError('Invalid project key')
  }
}

const projectDir = (root: string, key: string): string => {
  assertValidKey(key)
  return join(root, key)
}

const writeJsonAtomically = async (path: string, value: unknown): Promise<void> => {
  const tempPath = `${path}.tmp`
  await writeFile(tempPath, JSON.stringify(value, null, 2), 'utf8')
  await rename(tempPath, path)
}

const hasThumbnail = async (dir: string): Promise<boolean> => {
  try {
    await stat(join(dir, THUMBNAIL_FILE))
    return true
  } catch {
    return false
  }
}

/** Reads and validates a project. The returned value is always the current schema. */
export const readProject = async (root: string, key: string): Promise<ProjectFile> => {
  const dir = projectDir(root, key)
  const raw = await readFile(join(dir, PROJECT_FILE_NAME), 'utf8')
  return parseProject(JSON.parse(raw), () => randomUUID())
}

const writeProject = async (root: string, key: string, project: ProjectFile): Promise<void> => {
  const dir = projectDir(root, key)
  await writeJsonAtomically(join(dir, PROJECT_FILE_NAME), {
    ...project,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    updatedAt: new Date().toISOString()
  })
}

export const listProjects = async (root: string): Promise<ProjectSummary[]> => {
  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch {
    return []
  }

  const summaries: ProjectSummary[] = []

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue

    try {
      const project = await readProject(root, entry.name)
      summaries.push({
        key: entry.name,
        id: project.id,
        name: project.name,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        durationMs: Math.round(projectDurationMs(project)),
        status: project.status,
        hasThumbnail: await hasThumbnail(join(root, entry.name)),
        error: null
      })
    } catch (error) {
      summaries.push({
        key: entry.name,
        id: null,
        name: entry.name,
        createdAt: null,
        updatedAt: null,
        durationMs: 0,
        status: null,
        hasThumbnail: false,
        error: error instanceof Error ? error.message : 'Unreadable project'
      })
    }
  }

  return summaries.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
}

export const renameProject = async (root: string, key: string, name: string): Promise<void> => {
  const trimmed = name.trim().slice(0, 120)
  if (!trimmed) throw new ProjectError('Project name cannot be empty')

  const project = await readProject(root, key)
  await writeProject(root, key, { ...project, name: trimmed })
}

export const saveEditor = async (
  root: string,
  key: string,
  editor: unknown
): Promise<EditorState> => {
  const project = await readProject(root, key)
  const normalized = normalizeEditor(editor)
  await writeProject(root, key, { ...project, editor: normalized })
  return normalized
}

const uniqueFolderName = async (root: string, base: string): Promise<string> => {
  for (let attempt = 1; attempt <= 200; attempt += 1) {
    const name = attempt === 1 ? base : `${base} (${attempt})`
    try {
      await stat(join(root, name))
    } catch {
      return name
    }
  }
  throw new ProjectError('Could not find a free folder name')
}

/** Copies a project folder and gives the copy a new id and name. */
export const duplicateProject = async (root: string, key: string): Promise<string> => {
  const source = await readProject(root, key)
  const copyKey = await uniqueFolderName(root, `${key} copy`)

  await cp(projectDir(root, key), projectDir(root, copyKey), {
    recursive: true,
    errorOnExist: true
  })
  await writeProject(root, copyKey, {
    ...source,
    id: randomUUID(),
    name: `${source.name} copy`
  })

  return copyKey
}

/** Copies a project folder from outside the root, keeping its media and giving it a new id. */
export const importProject = async (root: string, sourceDir: string): Promise<string> => {
  const raw = await readFile(join(sourceDir, PROJECT_FILE_NAME), 'utf8')
  const source = parseProject(JSON.parse(raw), () => randomUUID())
  const folderName = basename(sourceDir) || 'Imported project'

  await mkdir(root, { recursive: true })
  const key = await uniqueFolderName(root, folderName)
  await cp(sourceDir, join(root, key), { recursive: true, errorOnExist: true })
  await writeProject(root, key, { ...source, id: randomUUID() })
  return key
}

/** Copies a project folder into `destinationRoot` so it can be shared or backed up. */
export const exportProject = async (
  root: string,
  key: string,
  destinationRoot: string
): Promise<string> => {
  const project = await readProject(root, key)
  await mkdir(destinationRoot, { recursive: true })
  const name = await uniqueFolderName(destinationRoot, project.name.replace(/[\\/:*?"<>|]/g, '_'))
  await cp(projectDir(root, key), join(destinationRoot, name), {
    recursive: true,
    errorOnExist: true
  })
  return join(destinationRoot, name)
}

export const saveThumbnail = async (
  root: string,
  key: string,
  data: ArrayBuffer
): Promise<void> => {
  const dir = projectDir(root, key)
  await writeFile(join(dir, THUMBNAIL_FILE), Buffer.from(data))
}

export const readThumbnailDataUrl = async (root: string, key: string): Promise<string | null> => {
  try {
    const bytes = await readFile(join(projectDir(root, key), THUMBNAIL_FILE))
    return `data:image/jpeg;base64,${bytes.toString('base64')}`
  } catch {
    return null
  }
}

/** Resolves a media file name from a project, only if the project actually lists it. */
export const resolveMediaPath = async (
  root: string,
  key: string,
  fileName: string
): Promise<string | null> => {
  if (fileName.includes('/') || fileName.includes('\\') || fileName.startsWith('.')) return null

  const project = await readProject(root, key)
  const listed =
    Object.values(project.tracks).some((track) => track?.fileName === fileName) ||
    project.events.fileName === fileName

  return listed ? join(projectDir(root, key), fileName) : null
}

/** Moves a project folder to the system trash so the action can be undone. */
export const deleteProjectToTrash = async (
  root: string,
  key: string,
  moveToTrash: (path: string) => Promise<void>
): Promise<void> => {
  const dir = projectDir(root, key)
  await stat(join(dir, PROJECT_FILE_NAME))
  await moveToTrash(dir)
}
