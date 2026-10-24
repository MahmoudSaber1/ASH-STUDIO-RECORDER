import { describe, expect, it } from 'vitest'
import { keyLabel, normalizePoint, parseEventLog } from '../events'
import { activeMsToVideoSeconds, videoSecondsToActiveMs } from '../sync'

describe('parseEventLog', () => {
  it('reads valid lines in time order and skips a crash-cut tail', () => {
    const text = [
      '{"t":200,"type":"mousedown","x":1,"y":2}',
      '{"t":100,"type":"mousemove","x":0,"y":0}',
      '{"t":300,"type":"mou'
    ].join('\n')

    const events = parseEventLog(text)
    expect(events.map((event) => event.t)).toEqual([100, 200])
  })
})

describe('normalizePoint', () => {
  it('maps global coordinates into the capture and clamps the edges', () => {
    const bounds = { x: 1000, y: 0, width: 2000, height: 1000 }
    expect(normalizePoint(2000, 500, bounds)).toEqual({ x: 0.5, y: 0.5 })
    expect(normalizePoint(0, -50, bounds)).toEqual({ x: 0, y: 0 })
  })
})

describe('sync', () => {
  const anchor = { epoch: 10_000, mediaStartedAt: 10_250 }

  it('converts video time to the active clock and back', () => {
    expect(videoSecondsToActiveMs(2, anchor)).toBe(2250)
    expect(activeMsToVideoSeconds(2250, anchor)).toBe(2)
  })
})

describe('keyLabel', () => {
  it('labels known keys and falls back for unknown ones', () => {
    expect(keyLabel(0x001e)).toBe('A')
    expect(keyLabel(0x0039)).toBe('Space')
    expect(keyLabel(undefined)).toBe('•')
  })
})
