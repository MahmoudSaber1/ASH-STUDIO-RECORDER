import { describe, expect, it } from 'vitest'
import { cursorAt, ripplesAt, smoothedCursorAt } from '../cursor'

const samples = [
  { t: 0, x: 0, y: 0 },
  { t: 100, x: 1, y: 1 },
  { t: 200, x: 1, y: 0 }
]

describe('cursorAt', () => {
  it('interpolates between samples', () => {
    expect(cursorAt(50, samples)).toEqual({ x: 0.5, y: 0.5 })
    expect(cursorAt(150, samples)).toEqual({ x: 1, y: 0.5 })
  })

  it('clamps outside the sampled range and returns null when empty', () => {
    expect(cursorAt(-10, samples)).toEqual({ x: 0, y: 0 })
    expect(cursorAt(999, samples)).toEqual({ x: 1, y: 0 })
    expect(cursorAt(0, [])).toBeNull()
  })
})

describe('smoothedCursorAt', () => {
  it('equals the raw position at zero smoothing', () => {
    expect(smoothedCursorAt(150, samples, 0)).toEqual(cursorAt(150, samples))
  })

  it('lags behind the raw position when smoothing is on', () => {
    const raw = cursorAt(150, samples)
    const smooth = smoothedCursorAt(150, samples, 1)
    expect(raw).not.toBeNull()
    expect(smooth).not.toBeNull()
    expect(smooth?.x).toBeLessThan(raw?.x ?? 0)
  })
})

describe('ripplesAt', () => {
  it('returns ripples only while they are visible', () => {
    const clicks = [{ t: 1000, x: 0.5, y: 0.5 }]
    expect(ripplesAt(999, clicks)).toEqual([])
    expect(ripplesAt(1300, clicks)).toEqual([{ x: 0.5, y: 0.5, progress: 0.5 }])
    expect(ripplesAt(1700, clicks)).toEqual([])
  })
})
