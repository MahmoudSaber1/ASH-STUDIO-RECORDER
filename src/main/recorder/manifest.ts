import { rename, writeFile } from 'node:fs/promises'
import type { CaptureTarget, RecorderOptions, RecorderTrack } from '@shared/ipc'

export type RecordingStatus = 'recording' | 'completed' | 'incomplete' | 'error'

export interface RecordingTrackInfo {
  fileName: string
  bytes: number
  startedAt: number
}

export interface RecordingManifest {
  schemaVersion: 1
  id: string
  app: {
    name: string
    version: string
  }
  status: RecordingStatus
  createdAt: string
  updatedAt: string
  target: CaptureTarget
  options: RecorderOptions
  timing: {
    /** Unix epoch (ms) when the session began. */
    epoch: number
    startedAt: number
    endedAt: number | null
    pausedTotalMs: number
    /** Input events use active (unpaused) recording time. */
    clock: 'active'
  }
  /** Absolute wall-clock time each MediaRecorder produced its first frame. */
  mediaStartedAt: Partial<Record<RecorderTrack, number>>
  tracks: Partial<Record<RecorderTrack, RecordingTrackInfo>>
  events: {
    fileName: string
    count: number
  }
  notes: string[]
}

/**
 * Writes `project.json` atomically (temp file + rename). Updates are
 * fire-and-forget and always serialize in call order.
 */
export class ManifestWriter {
  private queue: Promise<void> = Promise.resolve()
  private closed = false

  constructor(
    private readonly path: string,
    readonly data: RecordingManifest
  ) {}

  update(mutate?: (data: RecordingManifest) => void): Promise<void> {
    if (this.closed) return this.queue

    mutate?.(this.data)
    this.data.updatedAt = new Date().toISOString()
    const snapshot = JSON.stringify(this.data, null, 2)

    this.queue = this.queue
      .then(async () => {
        const tempPath = `${this.path}.tmp`
        await writeFile(tempPath, snapshot, 'utf8')
        await rename(tempPath, this.path)
      })
      .catch((error) => {
        console.error('[recorder] failed to write project manifest', error)
      })

    return this.queue
  }

  async flush(): Promise<void> {
    await this.queue
  }

  async close(): Promise<void> {
    await this.flush()
    this.closed = true
  }
}
