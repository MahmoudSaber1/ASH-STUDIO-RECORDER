import { describe, expect, it } from 'vitest'
import { createDefaultEditor } from '../project'
import {
  buildSegments,
  mergeRanges,
  outputDurationMs,
  outputToSource,
  sourceToOutput
} from '../timeline'

describe('mergeRanges', () => {
  it('sorts and merges overlapping and touching ranges', () => {
    expect(
      mergeRanges([
        { start: 500, end: 800 },
        { start: 0, end: 300 },
        { start: 300, end: 400 }
      ])
    ).toEqual([
      { start: 0, end: 400 },
      { start: 500, end: 800 }
    ])
  })
})

describe('buildSegments', () => {
  it('keeps the whole recording by default', () => {
    expect(buildSegments(10_000, createDefaultEditor())).toEqual([
      { start: 0, end: 10_000, speed: 1 }
    ])
  })

  it('removes cut ranges and respects trim', () => {
    const editor = {
      ...createDefaultEditor(),
      trim: { start: 1000, end: 9000 },
      cuts: [{ start: 3000, end: 4000 }]
    }
    expect(buildSegments(10_000, editor)).toEqual([
      { start: 1000, end: 3000, speed: 1 },
      { start: 4000, end: 9000, speed: 1 }
    ])
  })

  it('splits around speed ramps and computes output duration', () => {
    const editor = {
      ...createDefaultEditor(),
      speedRamps: [{ id: 'r', start: 2000, end: 4000, speed: 2 }]
    }
    const segments = buildSegments(6000, editor)
    expect(segments).toEqual([
      { start: 0, end: 2000, speed: 1 },
      { start: 2000, end: 4000, speed: 2 },
      { start: 4000, end: 6000, speed: 1 }
    ])
    expect(outputDurationMs(segments)).toBe(2000 + 1000 + 2000)
  })

  it('returns no segments for an empty trim', () => {
    const editor = { ...createDefaultEditor(), trim: { start: 5000, end: 5000 } }
    expect(buildSegments(10_000, editor)).toEqual([])
  })

  it('maps source and output time in both directions', () => {
    const segments = buildSegments(10_000, {
      ...createDefaultEditor(),
      cuts: [{ start: 2000, end: 4000 }],
      speedRamps: [{ id: 'r', start: 6000, end: 8000, speed: 4 }]
    })
    expect(sourceToOutput(1000, segments)).toBe(1000)
    expect(sourceToOutput(3000, segments)).toBe(2000)
    expect(sourceToOutput(7000, segments)).toBe(4250)
    expect(outputToSource(0, segments)).toBe(0)
    expect(outputToSource(4250, segments)).toBe(7000)
  })
})
