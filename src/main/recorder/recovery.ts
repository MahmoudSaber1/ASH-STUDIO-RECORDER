import { readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { RecorderTrack } from '@shared/ipc'
import type { RecordingManifest } from './manifest'
import { EVENTS_FILE, getRecordingsRoot, MANIFEST_FILE } from './paths'

const PART_SUFFIX = '.webm.part'

/** Maps the base file name written by the manager to its recorder track. */
const TRACK_BY_BASE_NAME: Record<string, RecorderTrack> = {
  screen: 'screen',
  webcam: 'webcam',
  microphone: 'microphone',
  'system-audio': 'systemAudio'
}

const countValidEventLines = async (path: string): Promise<number> => {
  try {
    const raw = await readFile(path, 'utf8')
    let count = 0
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue
      try {
        JSON.parse(line)
        count += 1
      } catch {
        // A crash can leave a partial last line. Skip it instead of failing.
      }
    }
    return count
  } catch {
    return 0
  }
}

const writeManifestAtomically = async (
  path: string,
  manifest: RecordingManifest
): Promise<void> => {
  const tempPath = `${path}.tmp`
  await writeFile(tempPath, JSON.stringify(manifest, null, 2), 'utf8')
  await rename(tempPath, path)
}

/**
 * Recovers one session folder that was never finalized. `.webm.part` files are
 * promoted to `.webm` so the media can be opened, and the manifest is rewritten
 * to describe the tracks that actually exist on disk.
 */
async function recoverSessionDir(dir: string): Promise<boolean> {
  const manifestPath = join(dir, MANIFEST_FILE)

  let manifest: RecordingManifest
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as RecordingManifest
  } catch {
    return false
  }

  if (manifest.status === 'completed') return false

  const entries = await readdir(dir)
  const parts = entries.filter((name) => name.endsWith(PART_SUFFIX))

  if (manifest.status !== 'recording' && parts.length === 0) return false

  for (const partName of parts) {
    const baseName = partName.slice(0, -PART_SUFFIX.length)
    const track = TRACK_BY_BASE_NAME[baseName]
    const partPath = join(dir, partName)

    if (!track) continue

    const { size } = await stat(partPath)
    if (size === 0) {
      await rm(partPath, { force: true })
      continue
    }

    const fileName = `${baseName}.webm`
    await rename(partPath, join(dir, fileName))
    manifest.tracks[track] = {
      fileName,
      bytes: size,
      startedAt: manifest.mediaStartedAt[track] ?? manifest.timing.epoch
    }
  }

  const updatedAt = Date.now()
  manifest.status = 'incomplete'
  manifest.timing.endedAt = manifest.timing.endedAt ?? updatedAt
  manifest.events.count = await countValidEventLines(join(dir, EVENTS_FILE))
  manifest.updatedAt = new Date(updatedAt).toISOString()
  manifest.notes.push(
    'The app stopped before this recording was finalized. Media was rebuilt from the data written before the interruption.'
  )

  await writeManifestAtomically(manifestPath, manifest)
  return true
}

/** Scans the recordings folder once at launch and recovers every unfinished session. */
export async function recoverInterruptedRecordings(): Promise<number> {
  const root = getRecordingsRoot()

  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch {
    return 0
  }

  let recovered = 0

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    try {
      if (await recoverSessionDir(join(root, entry.name))) recovered += 1
    } catch (error) {
      console.error(`[recorder] could not recover ${entry.name}`, error)
    }
  }

  return recovered
}
