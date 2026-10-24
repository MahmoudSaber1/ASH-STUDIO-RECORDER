import type { EditorState, TimeRange } from './project'

/** A kept piece of the source recording, played at a constant speed. */
export interface Segment {
  start: number
  end: number
  speed: number
}

type TrimCutSpeed = Pick<EditorState, 'trim' | 'cuts' | 'speedRamps'>

/** Sorts ranges and merges any that overlap or touch. */
export const mergeRanges = (ranges: TimeRange[]): TimeRange[] => {
  const sorted = [...ranges].sort((a, b) => a.start - b.start)
  const merged: TimeRange[] = []

  for (const range of sorted) {
    const last = merged[merged.length - 1]
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end)
    } else {
      merged.push({ start: range.start, end: range.end })
    }
  }

  return merged
}

/**
 * Builds the playable segments from trim, cuts and speed ramps. Output time
 * is the concatenation of every segment's duration divided by its speed.
 */
export const buildSegments = (durationMs: number, editor: TrimCutSpeed): Segment[] => {
  const trimStart = Math.max(0, editor.trim?.start ?? 0)
  const trimEnd = Math.min(durationMs, editor.trim?.end ?? durationMs)
  if (trimEnd <= trimStart) return []

  const cuts = mergeRanges(editor.cuts)

  const kept: TimeRange[] = []
  let cursor = trimStart
  for (const cut of cuts) {
    if (cut.end <= cursor) continue
    if (cut.start >= trimEnd) break
    if (cut.start > cursor) kept.push({ start: cursor, end: Math.min(cut.start, trimEnd) })
    cursor = Math.max(cursor, cut.end)
  }
  if (cursor < trimEnd) kept.push({ start: cursor, end: trimEnd })

  const ramps = [...editor.speedRamps].sort((a, b) => a.start - b.start)
  const segments: Segment[] = []

  for (const piece of kept) {
    let position = piece.start

    for (const ramp of ramps) {
      const from = Math.max(ramp.start, position)
      const to = Math.min(ramp.end, piece.end)
      if (to <= from) continue

      if (from > position) segments.push({ start: position, end: from, speed: 1 })
      segments.push({ start: from, end: to, speed: ramp.speed })
      position = to
    }

    if (position < piece.end) segments.push({ start: position, end: piece.end, speed: 1 })
  }

  return segments
}

export const outputDurationMs = (segments: Segment[]): number =>
  segments.reduce((total, segment) => total + (segment.end - segment.start) / segment.speed, 0)

/** Maps a source time to its position on the edited timeline. Removed time collapses. */
export const sourceToOutput = (sourceMs: number, segments: Segment[]): number => {
  let output = 0

  for (const segment of segments) {
    if (sourceMs <= segment.start) return output
    if (sourceMs < segment.end) return output + (sourceMs - segment.start) / segment.speed
    output += (segment.end - segment.start) / segment.speed
  }

  return output
}

/** Maps a position on the edited timeline back to the source time it plays. */
export const outputToSource = (outputMs: number, segments: Segment[]): number => {
  let remaining = Math.max(0, outputMs)

  for (const segment of segments) {
    const length = (segment.end - segment.start) / segment.speed
    if (remaining < length) return segment.start + remaining * segment.speed
    remaining -= length
  }

  const last = segments[segments.length - 1]
  return last ? last.end : 0
}
