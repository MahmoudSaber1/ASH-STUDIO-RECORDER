import { spawn } from 'node:child_process'
import { rename, rm, stat } from 'node:fs/promises'
import { app } from 'electron'
import ffmpegStatic from 'ffmpeg-static'

/**
 * Path to the bundled FFmpeg. In a packaged app the binary lives outside the
 * asar archive, so the path is rewritten to the unpacked location.
 */
export const getFfmpegPath = (): string | null => {
  if (!ffmpegStatic) return null
  return app.isPackaged ? ffmpegStatic.replace('app.asar', 'app.asar.unpacked') : ffmpegStatic
}

const run = (binary: string, args: string[]): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-2000)
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.trim()}`))
    })
  })

/**
 * MediaRecorder writes WebM without a duration or seek index, so the editor
 * cannot seek or know the length. A stream copy adds both without re-encoding.
 * If the copy fails, the original file is kept as it was.
 */
export const remuxInPlace = async (path: string): Promise<boolean> => {
  const binary = getFfmpegPath()
  if (!binary) return false

  const temp = `${path}.remux.webm`
  try {
    await run(binary, ['-y', '-v', 'error', '-i', path, '-c', 'copy', temp])
    const { size } = await stat(temp)
    if (size === 0) throw new Error('empty output')
    await rename(temp, path)
    return true
  } catch (error) {
    console.warn(`[media] could not remux ${path}`, error)
    await rm(temp, { force: true })
    return false
  }
}
