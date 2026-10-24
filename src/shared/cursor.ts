/** A timestamped point in normalized coordinates (0 to 1). */
export interface PointSample {
  t: number
  x: number
  y: number
}

/**
 * Cursor position at `t`, linearly interpolated between the two nearest
 * samples. Returns null before the first sample. Samples must be sorted by `t`.
 */
export const cursorAt = (t: number, samples: PointSample[]): { x: number; y: number } | null => {
  const first = samples[0]
  const last = samples[samples.length - 1]
  if (!first || !last) return null
  if (t <= first.t) return { x: first.x, y: first.y }
  if (t >= last.t) return { x: last.x, y: last.y }

  let low = 0
  let high = samples.length - 1

  while (high - low > 1) {
    const mid = (low + high) >> 1
    const sample = samples[mid]
    if (!sample) break
    if (sample.t <= t) low = mid
    else high = mid
  }

  const a = samples[low]
  const b = samples[high]
  if (!a || !b) return null

  const span = b.t - a.t
  const ratio = span > 0 ? (t - a.t) / span : 0
  return { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio }
}

/**
 * Averages the cursor over a trailing window. `smoothing` (0 to 1) scales the
 * window from 0 ms (raw) to 600 ms. Stateless, so seeking stays exact.
 */
export const smoothedCursorAt = (
  t: number,
  samples: PointSample[],
  smoothing: number
): { x: number; y: number } | null => {
  const windowMs = Math.max(0, Math.min(1, smoothing)) * 600
  if (windowMs === 0) return cursorAt(t, samples)

  const steps = 8
  let x = 0
  let y = 0
  let count = 0

  for (let i = 0; i <= steps; i += 1) {
    const point = cursorAt(t - (windowMs * i) / steps, samples)
    if (!point) continue
    x += point.x
    y += point.y
    count += 1
  }

  return count === 0 ? null : { x: x / count, y: y / count }
}

export interface Ripple {
  x: number
  y: number
  /** 0 when the click starts, 1 when the ripple has finished. */
  progress: number
}

export const RIPPLE_DURATION_MS = 600

/** Click ripples that are still visible at `t`. */
export const ripplesAt = (t: number, clicks: PointSample[]): Ripple[] => {
  const ripples: Ripple[] = []

  for (const click of clicks) {
    const elapsed = t - click.t
    if (elapsed < 0 || elapsed > RIPPLE_DURATION_MS) continue
    ripples.push({ x: click.x, y: click.y, progress: elapsed / RIPPLE_DURATION_MS })
  }

  return ripples
}
