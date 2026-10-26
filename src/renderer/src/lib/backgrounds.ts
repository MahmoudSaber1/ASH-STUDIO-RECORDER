import type { Background, WallpaperId } from '@shared/project'

/**
 * Background painting shared by preview and export. Wallpapers are original,
 * procedural designs (no bundled images), drawn once per size and cached, so a
 * 4K export does not repaint them every frame.
 */

type Painter = (ctx: CanvasRenderingContext2D, w: number, h: number) => void

const linear = (
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stops: Array<[number, string]>
): CanvasGradient => {
  const gradient = ctx.createLinearGradient(x0, y0, x1, y1)
  for (const [at, color] of stops) gradient.addColorStop(at, color)
  return gradient
}

const radial = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  stops: Array<[number, string]>
): CanvasGradient => {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, r)
  for (const [at, color] of stops) gradient.addColorStop(at, color)
  return gradient
}

/** A soft blob, the building block of mesh-style gradients. */
const blob = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string
): void => {
  ctx.fillStyle = radial(ctx, x, y, r, [
    [0, color],
    [1, 'rgba(0,0,0,0)']
  ])
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
}

/** Filled band under a sine curve, used for hills and waves. */
const wave = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  baseY: number,
  amplitude: number,
  frequency: number,
  phase: number,
  fill: string | CanvasGradient
): void => {
  ctx.beginPath()
  ctx.moveTo(0, h)
  for (let x = 0; x <= w; x += Math.max(2, w / 240)) {
    const y = baseY + Math.sin((x / w) * Math.PI * 2 * frequency + phase) * amplitude
    ctx.lineTo(x, y)
  }
  ctx.lineTo(w, h)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
}

const PAINTERS: Record<WallpaperId, Painter> = {
  // Warm layered desert hills, in the spirit of recent macOS wallpapers.
  dunes: (ctx, w, h) => {
    ctx.fillStyle = linear(ctx, 0, 0, 0, h, [
      [0, '#f8dcb4'],
      [0.45, '#efae7a'],
      [1, '#c9674b']
    ])
    ctx.fillRect(0, 0, w, h)
    blob(ctx, w * 0.72, h * 0.28, h * 0.35, 'rgba(255, 244, 214, 0.9)')
    const layers: Array<[number, number, number, number, string]> = [
      [0.55, 0.05, 0.8, 0.4, '#e08f5d'],
      [0.66, 0.06, 1.1, 1.7, '#c56a46'],
      [0.77, 0.05, 0.7, 3.1, '#9c4733'],
      [0.88, 0.04, 1.3, 4.4, '#6c2d26']
    ]
    for (const [base, amp, freq, phase, color] of layers) {
      wave(ctx, w, h, h * base, h * amp, freq, phase, color)
    }
  },
  // Overlapping translucent petals on deep blue, in the spirit of Windows.
  bloom: (ctx, w, h) => {
    ctx.fillStyle = radial(ctx, w * 0.6, h * 0.55, Math.max(w, h) * 0.8, [
      [0, '#0b3a8a'],
      [1, '#020617']
    ])
    ctx.fillRect(0, 0, w, h)
    ctx.save()
    ctx.translate(w * 0.6, h * 0.58)
    ctx.globalCompositeOperation = 'lighter'
    const size = Math.min(w, h)
    for (let index = 0; index < 6; index += 1) {
      ctx.save()
      ctx.rotate((index / 6) * Math.PI * 2 + 0.3)
      ctx.beginPath()
      ctx.ellipse(size * 0.18, 0, size * 0.26, size * 0.1, 0, 0, Math.PI * 2)
      ctx.fillStyle = linear(ctx, 0, 0, size * 0.45, 0, [
        [0, 'rgba(59, 130, 246, 0.05)'],
        [1, 'rgba(147, 197, 253, 0.55)']
      ])
      ctx.fill()
      ctx.restore()
    }
    ctx.restore()
  },
  aurora: (ctx, w, h) => {
    ctx.fillStyle = linear(ctx, 0, 0, 0, h, [
      [0, '#020b16'],
      [1, '#06202a']
    ])
    ctx.fillRect(0, 0, w, h)
    ctx.save()
    ctx.filter = `blur(${Math.round(h * 0.05)}px)`
    ctx.globalCompositeOperation = 'lighter'
    wave(ctx, w, h, h * 0.45, h * 0.08, 1.2, 0.4, 'rgba(34, 197, 94, 0.35)')
    wave(ctx, w, h, h * 0.55, h * 0.1, 0.9, 2.2, 'rgba(20, 184, 166, 0.3)')
    wave(ctx, w, h, h * 0.62, h * 0.07, 1.6, 4.1, 'rgba(139, 92, 246, 0.3)')
    ctx.restore()
    ctx.fillStyle = 'rgba(2, 6, 23, 0.45)'
    ctx.fillRect(0, h * 0.8, w, h * 0.2)
  },
  ocean: (ctx, w, h) => {
    ctx.fillStyle = linear(ctx, 0, 0, 0, h, [
      [0, '#7dd3fc'],
      [0.5, '#0ea5e9'],
      [1, '#0c4a6e']
    ])
    ctx.fillRect(0, 0, w, h)
    const layers: Array<[number, number, number, number, string]> = [
      [0.5, 0.03, 2.2, 0.2, 'rgba(14, 116, 144, 0.55)'],
      [0.62, 0.035, 1.7, 1.9, 'rgba(8, 92, 128, 0.7)'],
      [0.75, 0.03, 2.6, 3.3, 'rgba(7, 66, 99, 0.85)'],
      [0.88, 0.025, 1.9, 5.0, 'rgba(4, 44, 70, 0.95)']
    ]
    for (const [base, amp, freq, phase, color] of layers) {
      wave(ctx, w, h, h * base, h * amp, freq, phase, color)
    }
  },
  sunset: (ctx, w, h) => {
    ctx.fillStyle = '#ff7e5f'
    ctx.fillRect(0, 0, w, h)
    const r = Math.max(w, h) * 0.7
    blob(ctx, w * 0.15, h * 0.2, r, 'rgba(254, 180, 123, 0.95)')
    blob(ctx, w * 0.85, h * 0.25, r * 0.8, 'rgba(255, 106, 136, 0.85)')
    blob(ctx, w * 0.5, h * 1.0, r * 0.9, 'rgba(142, 68, 173, 0.8)')
  },
  'violet-mesh': (ctx, w, h) => {
    ctx.fillStyle = '#1e1b4b'
    ctx.fillRect(0, 0, w, h)
    const r = Math.max(w, h) * 0.6
    blob(ctx, w * 0.2, h * 0.3, r, 'rgba(124, 58, 237, 0.85)')
    blob(ctx, w * 0.8, h * 0.2, r * 0.8, 'rgba(236, 72, 153, 0.6)')
    blob(ctx, w * 0.65, h * 0.9, r, 'rgba(59, 130, 246, 0.6)')
  },
  mint: (ctx, w, h) => {
    ctx.fillStyle = linear(ctx, 0, 0, w, h, [
      [0, '#d4fc79'],
      [1, '#96e6a1']
    ])
    ctx.fillRect(0, 0, w, h)
    blob(ctx, w * 0.3, h * 0.3, Math.max(w, h) * 0.5, 'rgba(255, 255, 255, 0.55)')
  },
  graphite: (ctx, w, h) => {
    ctx.fillStyle = radial(ctx, w * 0.5, h * 0.4, Math.max(w, h) * 0.75, [
      [0, '#3f3f46'],
      [1, '#0a0a0b']
    ])
    ctx.fillRect(0, 0, w, h)
  }
}

export const WALLPAPER_LABELS: Record<WallpaperId, string> = {
  dunes: 'Dunes',
  bloom: 'Bloom',
  aurora: 'Aurora',
  ocean: 'Ocean',
  sunset: 'Sunset',
  'violet-mesh': 'Violet mesh',
  mint: 'Mint',
  graphite: 'Graphite'
}

const MAX_CACHE = 12
const cache = new Map<string, HTMLCanvasElement>()

const remember = (key: string, canvas: HTMLCanvasElement): HTMLCanvasElement => {
  if (cache.size >= MAX_CACHE) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, canvas)
  return canvas
}

const offscreen = (w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] | null => {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w))
  canvas.height = Math.max(1, Math.round(h))
  const ctx = canvas.getContext('2d')
  return ctx ? [canvas, ctx] : null
}

export const wallpaperCanvas = (
  id: WallpaperId,
  w: number,
  h: number
): HTMLCanvasElement | null => {
  const key = `wallpaper:${id}:${Math.round(w)}x${Math.round(h)}`
  const cached = cache.get(key)
  if (cached) return cached
  const made = offscreen(w, h)
  if (!made) return null
  const [canvas, ctx] = made
  PAINTERS[id](ctx, canvas.width, canvas.height)
  return remember(key, canvas)
}

const images = new Map<string, Promise<HTMLImageElement>>()
const loadedImages = new Map<string, HTMLImageElement>()

/** Loads a background image once. The exporter awaits this before rendering. */
export const loadBackgroundImage = (url: string): Promise<HTMLImageElement> => {
  const existing = images.get(url)
  if (existing) return existing

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      loadedImages.set(url, image)
      resolve(image)
    }
    image.onerror = () => {
      images.delete(url)
      reject(new Error('Could not load the background image'))
    }
    image.src = url
  })
  images.set(url, promise)
  return promise
}

/** Cover-fits an image into the frame, blurred once per size and cached. */
const imageCanvas = (url: string, blur: number, w: number, h: number): HTMLCanvasElement | null => {
  const image = loadedImages.get(url)
  if (!image) return null

  const key = `image:${url}:${blur}:${Math.round(w)}x${Math.round(h)}`
  const cached = cache.get(key)
  if (cached) return cached
  const made = offscreen(w, h)
  if (!made) return null
  const [canvas, ctx] = made

  const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight)
  const dw = image.naturalWidth * scale
  const dh = image.naturalHeight * scale
  const radius = blur * (canvas.height / 1080)
  if (radius > 0) {
    // Draw slightly larger so the blur does not fade the edges.
    ctx.filter = `blur(${radius}px)`
    const pad = radius * 2
    ctx.drawImage(
      image,
      (canvas.width - dw) / 2 - pad,
      (canvas.height - dh) / 2 - pad,
      dw + pad * 2,
      dh + pad * 2
    )
  } else {
    ctx.drawImage(image, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh)
  }
  return remember(key, canvas)
}

/** Paints any background type. Images not loaded yet fall back to near-black. */
export const paintBackground = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  background: Background,
  assetUrl: (fileName: string) => string
): void => {
  if (background.kind === 'solid') {
    ctx.fillStyle = background.color
    ctx.fillRect(0, 0, width, height)
    return
  }

  if (background.kind === 'gradient') {
    // CSS convention, so the swatches and the frame agree: 0° points up, 90° right, 180° down.
    const radians = (background.angle * Math.PI) / 180
    const dx = Math.sin(radians) * width
    const dy = -Math.cos(radians) * height
    ctx.fillStyle = linear(
      ctx,
      width / 2 - dx / 2,
      height / 2 - dy / 2,
      width / 2 + dx / 2,
      height / 2 + dy / 2,
      [
        [0, background.from],
        [1, background.to]
      ]
    )
    ctx.fillRect(0, 0, width, height)
    return
  }

  const layer =
    background.kind === 'wallpaper'
      ? wallpaperCanvas(background.id, width, height)
      : imageCanvas(assetUrl(background.fileName), background.blur, width, height)

  if (layer) {
    ctx.drawImage(layer, 0, 0, width, height)
  } else {
    ctx.fillStyle = '#0b0b0f'
    ctx.fillRect(0, 0, width, height)
  }
}
