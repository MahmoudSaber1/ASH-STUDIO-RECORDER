import { mediaUrl } from '@shared/media'

export interface FilmFrame {
  /** Timeline ms where this frame starts. */
  startMs: number
  url: string
}

const WIDTH = 160
const HEIGHT = 90

const seekAndWait = (video: HTMLVideoElement, seconds: number): Promise<void> =>
  new Promise((resolve, reject) => {
    video.addEventListener('seeked', () => resolve(), { once: true })
    video.addEventListener('error', () => reject(new Error('frame decode failed')), { once: true })
    video.currentTime = seconds
  })

/**
 * Small preview frames across the screen track, for the clip row of the
 * timeline. Uses its own video element so the preview's seeking is not affected.
 */
export const buildFilmstrip = async (args: {
  key: string
  fileName: string
  durationMs: number
  screenOffsetMs: number
  isCancelled: () => boolean
}): Promise<FilmFrame[]> => {
  const video = document.createElement('video')
  video.crossOrigin = 'anonymous'
  video.muted = true
  video.preload = 'auto'
  video.src = mediaUrl(args.key, args.fileName)

  await new Promise<void>((resolve, reject) => {
    video.addEventListener('loadedmetadata', () => resolve(), { once: true })
    video.addEventListener('error', () => reject(new Error('no video')), { once: true })
  })

  const videoSeconds = Number.isFinite(video.duration) ? video.duration : 0
  if (videoSeconds <= 0) return []

  const count = Math.min(60, Math.max(8, Math.round(videoSeconds / 2)))
  const stepSeconds = videoSeconds / count
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) return []

  const frames: FilmFrame[] = []
  for (let index = 0; index < count; index += 1) {
    if (args.isCancelled()) break
    const seconds = index * stepSeconds
    await seekAndWait(video, seconds)

    const scale = Math.max(WIDTH / video.videoWidth, HEIGHT / video.videoHeight)
    const w = video.videoWidth * scale
    const h = video.videoHeight * scale
    ctx.drawImage(video, (WIDTH - w) / 2, (HEIGHT - h) / 2, w, h)

    frames.push({
      startMs: args.screenOffsetMs + seconds * 1000,
      url: canvas.toDataURL('image/jpeg', 0.6)
    })
  }

  video.removeAttribute('src')
  video.load()
  return frames
}
