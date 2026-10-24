import { describe, expect, it } from 'vitest'
import { deleteRange, findIdleRanges, restoreRange, setSpeedRamp, splitAt } from '../editing'
import { createDefaultEditor } from '../project'
import { buildSegments, outputDurationMs } from '../timeline'

describe('editing commands', () => {
  it('split does not change the output duration', () => {
    const base = createDefaultEditor()
    const split = splitAt(base, 3000)
    expect(outputDurationMs(buildSegments(10_000, split))).toBe(
      outputDurationMs(buildSegments(10_000, base))
    )
    expect(buildSegments(10_000, split)).toHaveLength(2)
  })

  it('delete then restore returns the original cuts', () => {
    const base = createDefaultEditor()
    const cut = deleteRange(base, { start: 1000, end: 2000 })
    expect(cut.cuts).toEqual([{ start: 1000, end: 2000 }])
    expect(restoreRange(cut, { start: 1000, end: 2000 }).cuts).toEqual([])
  })

  it('restoring a middle slice splits a cut in two', () => {
    const cut = deleteRange(createDefaultEditor(), { start: 1000, end: 5000 })
    expect(restoreRange(cut, { start: 2000, end: 3000 }).cuts).toEqual([
      { start: 1000, end: 2000 },
      { start: 3000, end: 5000 }
    ])
  })

  it('a new speed ramp replaces overlapping ones', () => {
    let editor = setSpeedRamp(createDefaultEditor(), { start: 0, end: 4000 }, 2, 'a')
    editor = setSpeedRamp(editor, { start: 2000, end: 3000 }, 8, 'b')
    expect(editor.speedRamps.map((ramp) => [ramp.start, ramp.end, ramp.speed])).toEqual([
      [0, 2000, 2],
      [2000, 3000, 8],
      [3000, 4000, 2]
    ])
  })

  it('finds idle stretches longer than the threshold', () => {
    const events = [
      { t: 500, type: 'mousemove' as const },
      { t: 6000, type: 'keydown' as const, keycode: 30 }
    ]
    expect(findIdleRanges(events, 10_000)).toEqual([
      { start: 500, end: 6000 },
      { start: 6000, end: 10_000 }
    ])
  })
})
