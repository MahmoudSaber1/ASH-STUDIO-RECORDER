import { cameraAt, type CameraState } from '@shared/zoom'
import { cursorAt, ripplesAt, smoothedCursorAt } from '@shared/cursor'
import { isInsideCapture, keyLabel } from '@shared/events'
import { paintBackground } from './backgrounds'
import type { EditorState } from '@shared/project'
import type { InputSamples, ProjectMedia } from './project-media'

export interface FrameInput {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  timeMs: number
  editor: EditorState
  media: ProjectMedia
  /** Resolves a file name in the project folder to a URL, for image backgrounds. */
  assetUrl: (fileName: string) => string
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const roundedPath = (ctx: CanvasRenderingContext2D, rect: Rect, radius: number): void => {
  const r = Math.min(radius, rect.w / 2, rect.h / 2)
  ctx.beginPath()
  ctx.moveTo(rect.x + r, rect.y)
  ctx.arcTo(rect.x + rect.w, rect.y, rect.x + rect.w, rect.y + rect.h, r)
  ctx.arcTo(rect.x + rect.w, rect.y + rect.h, rect.x, rect.y + rect.h, r)
  ctx.arcTo(rect.x, rect.y + rect.h, rect.x, rect.y, r)
  ctx.arcTo(rect.x, rect.y, rect.x + rect.w, rect.y, r)
  ctx.closePath()
}

/** Largest rectangle with the source aspect that fits in the padded area, centered. */
const fitRect = (outer: Rect, aspect: number): Rect => {
  const outerAspect = outer.w / outer.h
  if (outerAspect > aspect) {
    const h = outer.h
    const w = h * aspect
    return { x: outer.x + (outer.w - w) / 2, y: outer.y, w, h }
  }
  const w = outer.w
  const h = w / aspect
  return { x: outer.x, y: outer.y + (outer.h - h) / 2, w, h }
}

/** Maps a normalized capture point into the frame rect, given the current camera. */
const toFrame = (
  point: { x: number; y: number },
  camera: CameraState,
  rect: Rect
): { x: number; y: number } => {
  const cropW = 1 / camera.scale
  const cropX = camera.centerX - cropW / 2
  const cropY = camera.centerY - cropW / 2
  return {
    x: rect.x + ((point.x - cropX) / cropW) * rect.w,
    y: rect.y + ((point.y - cropY) / cropW) * rect.h
  }
}

const drawCursor = (
  ctx: CanvasRenderingContext2D,
  at: { x: number; y: number },
  scale: number
): void => {
  ctx.save()
  ctx.translate(at.x, at.y)
  ctx.scale(scale, scale)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, 17)
  ctx.lineTo(4.5, 13)
  ctx.lineTo(7.5, 20)
  ctx.lineTo(10, 19)
  ctx.lineTo(7, 12.5)
  ctx.lineTo(12.5, 12.5)
  ctx.closePath()
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 1.2
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

const drawFaceCam = (
  ctx: CanvasRenderingContext2D,
  width: number,
  frame: Rect,
  editor: EditorState,
  webcam: HTMLVideoElement
): void => {
  const { faceCam } = editor
  const size = faceCam.size * width
  const margin = 0.03 * width
  const h = faceCam.shape === 'rect' ? size * 0.75 : size
  const x = faceCam.anchor.endsWith('left') ? frame.x + margin : frame.x + frame.w - margin - size
  const y = faceCam.anchor.startsWith('top') ? frame.y + margin : frame.y + frame.h - margin - h
  const rect = { x, y, w: size, h }

  const vw = webcam.videoWidth
  const vh = webcam.videoHeight
  if (!vw || !vh) return

  // Center-crop the webcam to the box so it is never stretched.
  const boxAspect = size / h
  const videoAspect = vw / vh
  const sw = videoAspect > boxAspect ? vh * boxAspect : vw
  const sh = videoAspect > boxAspect ? vh : vw / boxAspect
  const sx = (vw - sw) / 2
  const sy = (vh - sh) / 2

  ctx.save()
  if (faceCam.shape === 'circle') {
    ctx.beginPath()
    ctx.arc(x + size / 2, y + h / 2, size / 2, 0, Math.PI * 2)
  } else {
    roundedPath(ctx, rect, faceCam.shape === 'rounded' ? size * 0.18 : 0)
  }
  ctx.clip()

  if (faceCam.mirror) {
    ctx.translate(x + size, y)
    ctx.scale(-1, 1)
    ctx.drawImage(webcam, sx, sy, sw, sh, 0, 0, size, h)
  } else {
    ctx.drawImage(webcam, sx, sy, sw, sh, x, y, size, h)
  }
  ctx.restore()

  if (faceCam.border) {
    ctx.save()
    ctx.lineWidth = Math.max(2, width * 0.004)
    ctx.strokeStyle = '#ffffff'
    if (faceCam.shape === 'circle') {
      ctx.beginPath()
      ctx.arc(x + size / 2, y + h / 2, size / 2, 0, Math.PI * 2)
    } else {
      roundedPath(ctx, rect, faceCam.shape === 'rounded' ? size * 0.18 : 0)
    }
    ctx.stroke()
    ctx.restore()
  }
}

/**
 * Draws one complete output frame at `timeMs` on the timeline. The screen and
 * webcam elements must already be seeked to that time. Preview and export both
 * call this, so what you see is what gets encoded.
 */
export const drawFrame = (input: FrameInput): void => {
  const { ctx, width, height, timeMs, editor, media } = input
  const video = media.screen

  ctx.save()
  ctx.clearRect(0, 0, width, height)
  paintBackground(ctx, width, height, editor.background, input.assetUrl)

  const pad = editor.frame.padding * width
  const outer: Rect = { x: pad, y: pad, w: width - pad * 2, h: height - pad * 2 }
  const aspect = (video.videoWidth || 16) / (video.videoHeight || 9)
  const frame = fitRect(outer, aspect)
  const radius = editor.frame.radius * height

  const samples: InputSamples = media.samples
  const followCursor = editor.zoom.auto && samples.hasCursor
  const camera = cameraAt(timeMs, editor.zoom.segments, (t, segment) => {
    if (followCursor) {
      const point = smoothedCursorAt(t, samples.moves, editor.cursor.smoothing)
      // Keep following from the edge while the pointer is on another display.
      if (point)
        return { x: Math.min(Math.max(point.x, 0), 1), y: Math.min(Math.max(point.y, 0), 1) }
    }
    return { x: segment.focusX, y: segment.focusY }
  })

  // Frame with shadow and rounded corners.
  if (editor.frame.shadow > 0) {
    ctx.save()
    ctx.shadowColor = `rgba(0, 0, 0, ${0.6 * editor.frame.shadow})`
    ctx.shadowBlur = 60 * editor.frame.shadow * (height / 1080)
    ctx.shadowOffsetY = 12 * (height / 1080)
    ctx.fillStyle = '#000000'
    roundedPath(ctx, frame, radius)
    ctx.fill()
    ctx.restore()
  }

  ctx.save()
  roundedPath(ctx, frame, radius)
  ctx.clip()
  const vw = video.videoWidth || 1
  const vh = video.videoHeight || 1
  const sw = vw / camera.scale
  const sh = vh / camera.scale
  const sx = Math.min(Math.max(camera.centerX * vw - sw / 2, 0), vw - sw)
  const sy = Math.min(Math.max(camera.centerY * vh - sh / 2, 0), vh - sh)
  ctx.drawImage(video, sx, sy, sw, sh, frame.x, frame.y, frame.w, frame.h)
  ctx.restore()

  // Cursor data only means something when the capture bounds are known.
  if (samples.hasCursor) {
    const scale = editor.cursor.size * (frame.h / 720)
    // The pointer is hidden while it is outside the captured area, and cursor
    // effects never spill over the background around the frame.
    const raw = cursorAt(timeMs, samples.moves)
    const onScreen = raw !== null && isInsideCapture(raw)
    ctx.save()
    roundedPath(ctx, frame, radius)
    ctx.clip()

    if (editor.cursor.highlight && onScreen) {
      const point = raw
      if (point) {
        const at = toFrame(point, camera, frame)
        ctx.save()
        ctx.beginPath()
        ctx.arc(at.x, at.y, 34 * scale, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255, 214, 80, 0.28)'
        ctx.fill()
        ctx.restore()
      }
    }

    if (editor.cursor.clickRipples) {
      for (const ripple of ripplesAt(timeMs, samples.clicks)) {
        if (!isInsideCapture(ripple)) continue
        const at = toFrame(ripple, camera, frame)
        ctx.save()
        ctx.globalAlpha = 1 - ripple.progress
        ctx.beginPath()
        ctx.arc(at.x, at.y, (10 + 50 * ripple.progress) * scale, 0, Math.PI * 2)
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 3 * scale
        ctx.stroke()
        ctx.restore()
      }
    }

    if (editor.cursor.visible && onScreen) {
      const point =
        editor.cursor.smoothing > 0
          ? smoothedCursorAt(timeMs, samples.moves, editor.cursor.smoothing)
          : raw
      if (point) drawCursor(ctx, toFrame(point, camera, frame), scale)
    }
    ctx.restore()
  }

  if (editor.keystrokes) {
    const recent = samples.keys.filter((key) => key.t <= timeMs && key.t > timeMs - 1500)
    if (recent.length > 0) {
      const label = recent.map((key) => keyLabel(key.keycode)).join(' ')
      const fontSize = Math.round(26 * (height / 1080))
      ctx.save()
      ctx.font = `600 ${fontSize}px system-ui, sans-serif`
      const textWidth = ctx.measureText(label).width
      const padX = fontSize
      const boxW = textWidth + padX * 2
      const boxH = fontSize * 2
      const x = frame.x + frame.w / 2 - boxW / 2
      const y = frame.y + frame.h - boxH - fontSize
      ctx.fillStyle = 'rgba(12, 12, 18, 0.78)'
      roundedPath(ctx, { x, y, w: boxW, h: boxH }, boxH / 2)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, x + padX, y + boxH / 2)
      ctx.restore()
    }
  }

  if (
    editor.faceCam.enabled &&
    media.webcam &&
    !(editor.faceCam.hideDuringZoom && camera.scale > 1.01)
  ) {
    drawFaceCam(ctx, width, frame, editor, media.webcam)
  }

  ctx.restore()
}
