import { createWriteStream, type WriteStream } from 'node:fs'
import type { RecorderInputEvent } from '@shared/ipc'

/**
 * Serializes input events to JSONL. Writes are queued so the event order in the
 * file always matches the order the hooks delivered them in.
 */
export class EventsWriter {
  private readonly stream: WriteStream
  private queue: Promise<void> = Promise.resolve()
  private closed = false
  count = 0

  constructor(path: string) {
    this.stream = createWriteStream(path, { flags: 'w' })
    this.stream.on('error', (error) => {
      console.error('[recorder] event stream error', error)
    })
  }

  append(event: RecorderInputEvent): void {
    if (this.closed) return
    this.count += 1
    const line = `${JSON.stringify(event)}\n`

    this.queue = this.queue
      .then(
        () =>
          new Promise<void>((resolve, reject) => {
            this.stream.write(line, (error) => (error ? reject(error) : resolve()))
          })
      )
      .catch((error) => {
        console.error('[recorder] failed to append input event', error)
      })
  }

  async finish(): Promise<void> {
    if (this.closed) return
    this.closed = true
    await this.queue
    await new Promise<void>((resolve) => {
      this.stream.end(resolve)
    })
  }
}
