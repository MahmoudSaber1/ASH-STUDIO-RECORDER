import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import type { AppSettings } from '@shared/settings'

/** App preferences that survive restarts. Stored as JSON in the user data folder. */
export const DEFAULT_SETTINGS: AppSettings = { recordingsFolder: null }

const settingsPath = (): string => join(app.getPath('userData'), 'settings.json')

let cache: AppSettings | null = null

export const loadSettings = async (): Promise<AppSettings> => {
  if (cache) return cache
  try {
    const parsed = JSON.parse(await readFile(settingsPath(), 'utf8')) as Partial<AppSettings>
    cache = {
      recordingsFolder:
        typeof parsed.recordingsFolder === 'string' && parsed.recordingsFolder.trim()
          ? parsed.recordingsFolder
          : null
    }
  } catch {
    cache = { ...DEFAULT_SETTINGS }
  }
  return cache
}

export const saveSettings = async (next: AppSettings): Promise<AppSettings> => {
  const directory = app.getPath('userData')
  await mkdir(directory, { recursive: true })
  const tempPath = `${settingsPath()}.tmp`
  await writeFile(tempPath, JSON.stringify(next, null, 2), 'utf8')
  await rename(tempPath, settingsPath())
  cache = next
  return next
}

/** Synchronous read for hot paths. Falls back to defaults until settings are loaded. */
export const currentRecordingsFolder = (): string | null => cache?.recordingsFolder ?? null
