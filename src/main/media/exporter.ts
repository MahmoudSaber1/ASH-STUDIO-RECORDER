import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { BrowserWindow, dialog } from 'electron'
import { buildFfmpegArgs, type ExportRequest } from './ffmpeg-args'
import { getFfmpegPath } from './remux'

interface ActiveExport {
  process: ChildProcessWithoutNullStreams
  outputPath: string
  stderr: string
  expectedBytes: number
  writtenBytes: number
  frames: number
  done: Promise<void>
}

const active = new Map<string, ActiveExport>()

const errorTail = (text: string): string => text.trim().split('\n').slice(-6).join('\n')

/** Asks the user where to save, then starts FFmpeg reading raw RGBA frames from stdin. */
export const startExport = async (request: ExportRequest): Promise<string | null> => {
  const binary = getFfmpegPath()
  if (!binary) throw new Error('FFmpeg is not available in this build')

  const parent = BrowserWindow.getFocusedWindow() ?? undefined
  const extension = request.format
  const result = await dialog.showSaveDialog(parent ?? ({} as BrowserWindow), {
    title: 'Export video',
    defaultPath: `${request.fileName}.${extension}`,
    filters: [{ name: extension.toUpperCase(), extensions: [extension] }]
  })
  if (result.canceled || !result.filePath) return null

  const outputPath = result.filePath
  const args = buildFfmpegArgs(request, outputPath)
  const child = spawn(binary, args, { stdio: ['pipe', 'pipe', 'pipe'] })
  const id = randomUUID()

  const entry: ActiveExport = {
    process: child,
    outputPath,
    stderr: '',
    expectedBytes: request.width * request.height * 4,
    writtenBytes: 0,
    frames: 0,
    done: Promise.resolve()
  }

  child.stderr.on('data', (chunk: Buffer) => {
    entry.stderr = (entry.stderr + chunk.toString()).slice(-4000)
  })

  entry.done = new Promise<void>((resolve, reject) => {
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`FFmpeg failed (${code})\n${errorTail(entry.stderr)}`))
    })
  })
  // The promise is awaited in finishExport; this stops an early failure from
  // being reported as unhandled if the user cancels first.
  entry.done.catch(() => undefined)

  active.set(id, entry)
  return id
}

/** Writes one frame. Waits for the pipe to drain so memory stays flat on long exports. */
export const writeFrame = (id: string, data: ArrayBuffer): Promise<void> => {
  const entry = active.get(id)
  if (!entry) return Promise.reject(new Error('Export is not running'))
  if (data.byteLength !== entry.expectedBytes) {
    return Promise.reject(new Error('Frame size does not match the export size'))
  }

  entry.frames += 1
  entry.writtenBytes += data.byteLength

  return new Promise((resolve, reject) => {
    const ok = entry.process.stdin.write(Buffer.from(data), (error) => {
      if (error) reject(error)
    })
    if (ok) resolve()
    else entry.process.stdin.once('drain', () => resolve())
  })
}

export const finishExport = async (id: string): Promise<string> => {
  const entry = active.get(id)
  if (!entry) throw new Error('Export is not running')

  entry.process.stdin.end()
  try {
    await entry.done
    return entry.outputPath
  } finally {
    active.delete(id)
  }
}

export const cancelExport = async (id: string): Promise<void> => {
  const entry = active.get(id)
  if (!entry) return
  active.delete(id)
  entry.process.kill('SIGKILL')
  await rm(entry.outputPath, { force: true })
}
