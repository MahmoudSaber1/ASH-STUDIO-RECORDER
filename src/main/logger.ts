import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

/**
 * Mirrors warnings, errors and uncaught exceptions to `main.log` in the app's
 * logs folder. Nothing is sent anywhere; the file stays on this machine.
 */
export const installFileLogger = (): string => {
  const directory = app.getPath('logs')
  mkdirSync(directory, { recursive: true })
  const file = join(directory, 'main.log')

  const write = (level: string, parts: unknown[]): void => {
    const text = parts
      .map((part) => (part instanceof Error ? (part.stack ?? part.message) : String(part)))
      .join(' ')
    try {
      appendFileSync(file, `${new Date().toISOString()} [${level}] ${text}\n`)
    } catch {
      // Logging must never throw into the app.
    }
  }

  for (const level of ['warn', 'error'] as const) {
    const original = console[level].bind(console)
    console[level] = (...parts: unknown[]) => {
      original(...parts)
      write(level, parts)
    }
  }

  process.on('uncaughtException', (error) => {
    write('fatal', [error])
  })
  process.on('unhandledRejection', (reason) => {
    write('fatal', [reason])
  })

  return file
}
