import { app } from 'electron'
import { currentRecordingsFolder } from '@main/settings'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

export const MANIFEST_FILE = 'project.json'
export const EVENTS_FILE = 'events.jsonl'

const pad = (value: number): string => String(value).padStart(2, '0')

const timestamp = (date: Date): string =>
  [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    ' ',
    pad(date.getHours()),
    '-',
    pad(date.getMinutes()),
    '-',
    pad(date.getSeconds())
  ].join('')

const slugify = (value: string): string => {
  const slug = value
    .replace(/[^\w\s.-]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
  return slug || 'Recording'
}

/**
 * Where recordings live. `ASH_RECORDINGS_DIR` wins so automated runs never touch
 * the user library, then the folder chosen in settings, then the Videos folder.
 */
export const getRecordingsRoot = (): string => {
  const override = process.env['ASH_RECORDINGS_DIR']?.trim()
  if (override) return override
  const chosen = currentRecordingsFolder()
  if (chosen) return chosen
  return join(app.getPath('videos'), 'Ash Studio Recorder')
}

export interface SessionDir {
  id: string
  dir: string
}

export async function createSessionDir(targetName: string): Promise<SessionDir> {
  const root = getRecordingsRoot()
  await mkdir(root, { recursive: true })

  const baseName = `${timestamp(new Date())} ${slugify(targetName)}`

  for (let attempt = 1; attempt <= 100; attempt += 1) {
    const name = attempt === 1 ? baseName : `${baseName} (${attempt})`
    const dir = join(root, name)

    try {
      await mkdir(dir)
      return { id: name, dir }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }
  }

  throw new Error('Could not create a unique recording folder')
}
