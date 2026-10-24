import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { extname } from 'node:path'
import { protocol } from 'electron'
import { getRecordingsRoot } from '@main/recorder/paths'
import { resolveMediaPath } from '@main/projects/store'

/** Scheme used by the renderer to play project media. Host is fixed to `media`. */
export const MEDIA_SCHEME = 'ash-media'

const MIME_TYPES: Record<string, string> = {
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.jpg': 'image/jpeg',
  '.jsonl': 'text/plain; charset=utf-8',
  '.json': 'application/json'
}

/** Builds a media URL for one file of one project. */
export const mediaUrl = (key: string, fileName: string): string =>
  `${MEDIA_SCHEME}://media/${encodeURIComponent(key)}/${encodeURIComponent(fileName)}`

/** Must run before the app is ready. */
export const registerMediaScheme = (): void => {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
    }
  ])
}

const parseRange = (header: string, size: number): { start: number; end: number } | null => {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match) return null

  const [, startText, endText] = match
  const start = startText ? Number(startText) : Math.max(0, size - Number(endText))
  const end = endText && startText ? Number(endText) : size - 1
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) return null

  return { start, end: Math.min(end, size - 1) }
}

/**
 * Serves project media with HTTP range support. Seeking in a <video> element
 * requires it, and without it long recordings stall when scrubbed.
 */
export const registerMediaProtocol = (): void => {
  protocol.handle(MEDIA_SCHEME, async (request) => {
    const url = new URL(request.url)
    const [key, fileName] = url.pathname
      .split('/')
      .slice(1)
      .map((part) => decodeURIComponent(part))
    if (!key || !fileName) return new Response('Not found', { status: 404 })

    const path = await resolveMediaPath(getRecordingsRoot(), key, fileName).catch(() => null)
    if (!path) return new Response('Not found', { status: 404 })

    const { size } = await stat(path)
    const type = MIME_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream'
    const rangeHeader = request.headers.get('range')

    if (rangeHeader) {
      const range = parseRange(rangeHeader, size)
      if (!range) {
        return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
      }

      const stream = Readable.toWeb(
        createReadStream(path, { start: range.start, end: range.end })
      ) as ReadableStream
      return new Response(stream, {
        status: 206,
        headers: {
          'Content-Type': type,
          'Content-Length': String(range.end - range.start + 1),
          'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
          'Accept-Ranges': 'bytes'
        }
      })
    }

    const stream = Readable.toWeb(createReadStream(path)) as ReadableStream
    return new Response(stream, {
      headers: {
        'Content-Type': type,
        'Content-Length': String(size),
        'Accept-Ranges': 'bytes'
      }
    })
  })
}
