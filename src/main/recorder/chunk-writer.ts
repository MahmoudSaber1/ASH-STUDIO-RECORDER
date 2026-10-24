import { open, rename, rm, type FileHandle } from 'node:fs/promises'
import { basename, join } from 'node:path'

export interface FinalizedTrack {
  fileName: string
  bytes: number
}

/**
 * Appends media chunks in order to a `.part` file and only publishes the final
 * `.webm` name once the recording is finalized, so a crash never leaves an
 * incomplete file that looks complete.
 */
export class ChunkWriter {
  private queue: Promise<void> = Promise.resolve()
  private bytesWritten = 0
  private closed = false

  private constructor(
    private readonly handle: FileHandle,
    private readonly partPath: string,
    private readonly finalPath: string
  ) {}

  static async create(directory: string, baseName: string): Promise<ChunkWriter> {
    const partPath = join(directory, `${baseName}.webm.part`)
    const finalPath = join(directory, `${baseName}.webm`)
    const handle = await open(partPath, 'w')
    return new ChunkWriter(handle, partPath, finalPath)
  }

  get size(): number {
    return this.bytesWritten
  }

  append(chunk: Buffer): Promise<void> {
    if (this.closed) return Promise.reject(new Error('Writer is already closed'))

    const operation = this.queue.then(async () => {
      await this.handle.write(chunk)
      this.bytesWritten += chunk.byteLength
    })

    this.queue = operation.catch(() => undefined)
    return operation
  }

  async finalize(): Promise<FinalizedTrack | null> {
    if (this.closed) return null
    this.closed = true
    await this.queue
    await this.handle.close()

    if (this.bytesWritten === 0) {
      await rm(this.partPath, { force: true })
      return null
    }

    await rename(this.partPath, this.finalPath)
    return { fileName: basename(this.finalPath), bytes: this.bytesWritten }
  }

  async abort(): Promise<void> {
    if (this.closed) return
    this.closed = true
    await this.queue
    await this.handle.close().catch(() => undefined)
    await rm(this.partPath, { force: true }).catch(() => undefined)
  }
}
