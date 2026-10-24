import { mediaUrl } from '@shared/media'

const WIDTH = 320
const HEIGHT = 180

/**
 * Captures a thumbnail from the screen track one second in (or the midpoint
 * for short clips) and saves it into the project folder.
 */
export const generateThumbnail = (key: string, screenFile: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.preload = 'auto'

    const cleanup = (): void => {
      video.removeAttribute('src')
      video.load()
    }

    video.addEventListener(
      'loadedmetadata',
      () => {
        const duration = Number.isFinite(video.duration) ? video.duration : 0
        video.currentTime = Math.min(1, duration / 2 || 0)
      },
      { once: true }
    )

    video.addEventListener(
      'seeked',
      () => {
        const canvas = document.createElement('canvas')
        canvas.width = WIDTH
        canvas.height = HEIGHT
        const ctx = canvas.getContext('2d')
        if (!ctx || !video.videoWidth) {
          cleanup()
          reject(new Error('Could not draw the thumbnail'))
          return
        }

        // Cover-fit so every thumbnail fills the same frame without distortion.
        const scale = Math.max(WIDTH / video.videoWidth, HEIGHT / video.videoHeight)
        const w = video.videoWidth * scale
        const h = video.videoHeight * scale
        ctx.drawImage(video, (WIDTH - w) / 2, (HEIGHT - h) / 2, w, h)

        canvas.toBlob(
          (blob) => {
            cleanup()
            if (!blob) {
              reject(new Error('Could not encode the thumbnail'))
              return
            }
            void blob
              .arrayBuffer()
              .then((data) => window.api.projects.saveThumbnail(key, data))
              .then(resolve, reject)
          },
          'image/jpeg',
          0.82
        )
      },
      { once: true }
    )

    video.addEventListener(
      'error',
      () => {
        cleanup()
        reject(new Error('Could not read the screen recording'))
      },
      { once: true }
    )

    video.src = mediaUrl(key, screenFile)
  })
