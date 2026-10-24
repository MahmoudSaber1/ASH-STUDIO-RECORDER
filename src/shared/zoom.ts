import type { ZoomSegment } from './project'

/** A click position in normalized screen coordinates (0 to 1). */
export interface ClickSample {
  t: number
  x: number
  y: number
}

export interface CameraState {
  /** Zoom factor. 1 means the full frame is shown. */
  scale: number
  /** Center of the visible crop in normalized coordinates. */
  centerX: number
  centerY: number
}

const SPRING_OMEGA = 9

/**
 * Step response of a critically damped spring starting at rest, in seconds.
 * Deterministic and stateless, so preview and export produce identical frames
 * for any time they seek to.
 */
export const springStep = (seconds: number): number => {
  if (seconds <= 0) return 0
  return 1 - (1 + SPRING_OMEGA * seconds) * Math.exp(-SPRING_OMEGA * seconds)
}

/** How strongly a segment is active at time `t` (ms), from 0 to 1. */
export const segmentWeight = (t: number, segment: ZoomSegment): number => {
  const rise = springStep((t - segment.start) / 1000)
  const fall = 1 - springStep((t - segment.end) / 1000)
  return rise * fall
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

/**
 * Turns click clusters into zoom segments. Sensitivity 1 zooms on every click;
 * 0 only zooms on bursts of three or more clicks.
 */
export const detectZoomSegments = (
  clicks: ClickSample[],
  options: { sensitivity: number; level: number; durationMs: number }
): ZoomSegment[] => {
  const sensitivity = clamp(options.sensitivity, 0, 1)
  const gapMs = 800 + (1 - sensitivity) * 1700
  const minClicks = sensitivity < 0.35 ? 3 : sensitivity < 0.7 ? 2 : 1

  const sorted = [...clicks].sort((a, b) => a.t - b.t)
  const clusters: ClickSample[][] = []

  for (const click of sorted) {
    const current = clusters[clusters.length - 1]
    const last = current?.[current.length - 1]
    if (current && last && click.t - last.t <= gapMs) {
      current.push(click)
    } else {
      clusters.push([click])
    }
  }

  const segments: ZoomSegment[] = []

  for (const cluster of clusters) {
    if (cluster.length < minClicks) continue

    const first = cluster[0]
    const last = cluster[cluster.length - 1]
    if (!first || !last) continue

    const start = Math.max(0, first.t - 350)
    const end = Math.min(options.durationMs, last.t + 1400)
    if (end <= start) continue

    const focusX = cluster.reduce((sum, click) => sum + click.x, 0) / cluster.length
    const focusY = cluster.reduce((sum, click) => sum + click.y, 0) / cluster.length
    const previous = segments[segments.length - 1]

    // Overlapping bursts become one longer segment instead of two fighting ones.
    if (previous && start <= previous.end) {
      previous.end = Math.max(previous.end, end)
      previous.focusX = (previous.focusX + focusX) / 2
      previous.focusY = (previous.focusY + focusY) / 2
      continue
    }

    segments.push({
      id: `auto-${segments.length + 1}`,
      start,
      end,
      level: options.level,
      focusX: clamp(focusX, 0, 1),
      focusY: clamp(focusY, 0, 1),
      source: 'auto'
    })
  }

  return segments
}

/**
 * Camera for time `t`. The crop is clamped so it never leaves the frame. When
 * `focusAt` is given, the focus follows it while the segment is active.
 */
export const cameraAt = (
  t: number,
  segments: ZoomSegment[],
  focusAt?: (t: number, segment: ZoomSegment) => { x: number; y: number }
): CameraState => {
  let best = 0
  let active: ZoomSegment | null = null

  for (const segment of segments) {
    const weight = segmentWeight(t, segment)
    if (weight > best) {
      best = weight
      active = segment
    }
  }

  if (!active || best < 0.0005) return { scale: 1, centerX: 0.5, centerY: 0.5 }

  const focus = focusAt ? focusAt(t, active) : { x: active.focusX, y: active.focusY }
  const scale = 1 + (active.level - 1) * best
  const half = 0.5 / scale

  return {
    scale,
    centerX: clamp(0.5 + (focus.x - 0.5) * best, half, 1 - half),
    centerY: clamp(0.5 + (focus.y - 0.5) * best, half, 1 - half)
  }
}
