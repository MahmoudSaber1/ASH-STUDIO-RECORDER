import { describe, expect, it } from 'vitest'
import type { ZoomSegment } from '../project'
import { cameraAt, detectZoomSegments, segmentWeight, springStep } from '../zoom'

const segment: ZoomSegment = {
  id: 'z',
  start: 1000,
  end: 4000,
  level: 1.6,
  focusX: 0.8,
  focusY: 0.2,
  source: 'manual'
}

describe('springStep', () => {
  it('starts at rest and settles to 1', () => {
    expect(springStep(0)).toBe(0)
    expect(springStep(-1)).toBe(0)
    expect(springStep(5)).toBeGreaterThan(0.999)
  })

  it('rises monotonically', () => {
    let previous = 0
    for (let t = 0.05; t <= 2; t += 0.05) {
      const value = springStep(t)
      expect(value).toBeGreaterThanOrEqual(previous)
      previous = value
    }
  })
})

describe('segmentWeight', () => {
  it('is near zero outside the segment and near one inside it', () => {
    expect(segmentWeight(0, segment)).toBe(0)
    expect(segmentWeight(3000, segment)).toBeGreaterThan(0.95)
    expect(segmentWeight(9000, segment)).toBeLessThan(0.01)
  })
})

describe('detectZoomSegments', () => {
  const clicks = [
    { t: 1000, x: 0.2, y: 0.3 },
    { t: 1200, x: 0.25, y: 0.35 },
    { t: 10_000, x: 0.7, y: 0.6 }
  ]

  it('creates one segment per burst at high sensitivity', () => {
    const segments = detectZoomSegments(clicks, {
      sensitivity: 1,
      level: 1.6,
      durationMs: 12_000
    })
    expect(segments).toHaveLength(2)
    expect(segments[0]).toMatchObject({ start: 650, end: 2600, source: 'auto' })
    expect(segments[1]).toMatchObject({ start: 9650, end: 11_400 })
  })

  it('needs bursts of three clicks at low sensitivity', () => {
    expect(detectZoomSegments(clicks, { sensitivity: 0, level: 1.6, durationMs: 12_000 })).toEqual(
      []
    )
  })

  it('clamps segments to the recording length', () => {
    const segments = detectZoomSegments([{ t: 9000, x: 0.5, y: 0.5 }], {
      sensitivity: 1,
      level: 1.6,
      durationMs: 9500
    })
    expect(segments[0]?.end).toBe(9500)
  })
})

describe('cameraAt', () => {
  it('shows the full frame when no segment is active', () => {
    expect(cameraAt(0, [segment])).toEqual({ scale: 1, centerX: 0.5, centerY: 0.5 })
  })

  it('zooms toward the focus point and keeps the crop inside the frame', () => {
    const camera = cameraAt(3000, [segment])
    expect(camera.scale).toBeCloseTo(1.6, 2)
    // Focus x 0.8 is clamped so the crop (width 1/1.6) stays inside the frame.
    expect(camera.centerX).toBeCloseTo(1 - 0.5 / 1.6, 2)
    expect(camera.centerY).toBeCloseTo(0.5 / 1.6, 2)
  })
})
