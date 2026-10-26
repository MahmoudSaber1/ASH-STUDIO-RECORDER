import type { EditorState, SpeedRamp, TimeRange, ZoomSegment } from './project'
import { mergeRanges } from './timeline'
import type { RecorderInputEvent } from './recorder'

/** Pure editing commands. Each returns a new editor state and never mutates its input. */

export const splitAt = (editor: EditorState, atMs: number): EditorState => {
  if (editor.splits.some((split) => Math.abs(split - atMs) < 1)) return editor
  return { ...editor, splits: [...editor.splits, atMs].sort((a, b) => a - b) }
}

/** Removes a range from the output. Overlapping cuts are merged. */
export const deleteRange = (editor: EditorState, range: TimeRange): EditorState => {
  if (range.end <= range.start) return editor
  return { ...editor, cuts: mergeRanges([...editor.cuts, range]) }
}

/** Brings back any removed time inside `range`. */
export const restoreRange = (editor: EditorState, range: TimeRange): EditorState => {
  const cuts: TimeRange[] = []

  for (const cut of editor.cuts) {
    if (cut.end <= range.start || cut.start >= range.end) {
      cuts.push(cut)
      continue
    }
    if (cut.start < range.start) cuts.push({ start: cut.start, end: range.start })
    if (cut.end > range.end) cuts.push({ start: range.end, end: cut.end })
  }

  return { ...editor, cuts }
}

export const setTrim = (editor: EditorState, range: TimeRange | null): EditorState => {
  if (range && range.end <= range.start) return editor
  return { ...editor, trim: range }
}

/** Sets a speed over `range`, replacing whatever ramps it overlaps. */
export const setSpeedRamp = (
  editor: EditorState,
  range: TimeRange,
  speed: number,
  id: string
): EditorState => {
  if (range.end <= range.start) return editor

  const kept: SpeedRamp[] = []
  for (const ramp of editor.speedRamps) {
    if (ramp.end <= range.start || ramp.start >= range.end) {
      kept.push(ramp)
      continue
    }
    if (ramp.start < range.start) kept.push({ ...ramp, end: range.start })
    if (ramp.end > range.end) kept.push({ ...ramp, id: `${ramp.id}-b`, start: range.end })
  }

  return {
    ...editor,
    speedRamps: [...kept, { id, start: range.start, end: range.end, speed }].sort(
      (a, b) => a.start - b.start
    )
  }
}

export const removeSpeedRamp = (editor: EditorState, id: string): EditorState => ({
  ...editor,
  speedRamps: editor.speedRamps.filter((ramp) => ramp.id !== id)
})

/**
 * Finds stretches with no mouse or keyboard input for at least `minIdleMs`
 * and returns them as ranges, for speeding up idle parts in one step.
 */
export const findIdleRanges = (
  events: RecorderInputEvent[],
  durationMs: number,
  minIdleMs = 2000
): TimeRange[] => {
  const idle: TimeRange[] = []
  let previous = 0

  for (const event of events) {
    if (event.t > durationMs) break
    if (event.t - previous >= minIdleMs) idle.push({ start: previous, end: event.t })
    previous = Math.max(previous, event.t)
  }

  if (durationMs - previous >= minIdleMs) idle.push({ start: previous, end: durationMs })
  return idle
}

export const addZoomSegment = (editor: EditorState, segment: ZoomSegment): EditorState => ({
  ...editor,
  zoom: {
    ...editor.zoom,
    segments: [...editor.zoom.segments, segment].sort((a, b) => a.start - b.start)
  }
})

export const updateZoomSegment = (
  editor: EditorState,
  id: string,
  patch: Partial<ZoomSegment>
): EditorState => ({
  ...editor,
  zoom: {
    ...editor.zoom,
    segments: editor.zoom.segments
      .map((segment) => (segment.id === id ? { ...segment, ...patch } : segment))
      .sort((a, b) => a.start - b.start)
  }
})

export const removeZoomSegment = (editor: EditorState, id: string): EditorState => ({
  ...editor,
  zoom: { ...editor.zoom, segments: editor.zoom.segments.filter((segment) => segment.id !== id) }
})

/** Removes every speed change inside `range`, so that stretch plays at 1×. */
export const clearSpeedRamps = (editor: EditorState, range: TimeRange): EditorState => {
  const kept: SpeedRamp[] = []

  for (const ramp of editor.speedRamps) {
    if (ramp.end <= range.start || ramp.start >= range.end) {
      kept.push(ramp)
      continue
    }
    if (ramp.start < range.start) kept.push({ ...ramp, end: range.start })
    if (ramp.end > range.end) kept.push({ ...ramp, id: `${ramp.id}-b`, start: range.end })
  }

  return { ...editor, speedRamps: kept }
}

/** Changes the speed of one existing ramp without moving it. */
export const setRampSpeed = (editor: EditorState, id: string, speed: number): EditorState => ({
  ...editor,
  speedRamps: editor.speedRamps.map((ramp) => (ramp.id === id ? { ...ramp, speed } : ramp))
})
