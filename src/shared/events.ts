import type { RecorderInputEvent } from './recorder'

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

/** Parses `events.jsonl`. Malformed lines, such as a crash-cut tail, are skipped. */
export const parseEventLog = (text: string): RecorderInputEvent[] => {
  const events: RecorderInputEvent[] = []

  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    try {
      const parsed = JSON.parse(line) as Partial<RecorderInputEvent>
      if (typeof parsed.t === 'number' && typeof parsed.type === 'string') {
        events.push(parsed as RecorderInputEvent)
      }
    } catch {
      // Skip partial lines left behind by a crash.
    }
  }

  return events.sort((a, b) => a.t - b.t)
}

/**
 * Converts global screen coordinates into normalized coordinates inside the
 * captured area. Points outside the capture are clamped to the edge.
 */
export const normalizePoint = (x: number, y: number, bounds: Bounds): { x: number; y: number } => ({
  x: Math.min(Math.max((x - bounds.x) / bounds.width, 0), 1),
  y: Math.min(Math.max((y - bounds.y) / bounds.height, 0), 1)
})

/**
 * Selected uiohook (libuiohook VC_*) key codes mapped to labels for the
 * keystroke overlay. Codes outside this table are shown as "•".
 */
const KEY_LABELS: Record<number, string> = {
  0x0001: 'Esc',
  0x000e: '⌫',
  0x000f: 'Tab',
  0x001c: '↵',
  0x0039: 'Space',
  0x0002: '1',
  0x0003: '2',
  0x0004: '3',
  0x0005: '4',
  0x0006: '5',
  0x0007: '6',
  0x0008: '7',
  0x0009: '8',
  0x000a: '9',
  0x000b: '0',
  0x001e: 'A',
  0x0030: 'B',
  0x002e: 'C',
  0x0020: 'D',
  0x0012: 'E',
  0x0021: 'F',
  0x0022: 'G',
  0x0023: 'H',
  0x0017: 'I',
  0x0024: 'J',
  0x0025: 'K',
  0x0026: 'L',
  0x0032: 'M',
  0x0031: 'N',
  0x0018: 'O',
  0x0019: 'P',
  0x0010: 'Q',
  0x0013: 'R',
  0x001f: 'S',
  0x0014: 'T',
  0x0016: 'U',
  0x002f: 'V',
  0x0011: 'W',
  0x002d: 'X',
  0x0015: 'Y',
  0x002c: 'Z'
}

export const keyLabel = (keycode: number | undefined): string =>
  (keycode !== undefined && KEY_LABELS[keycode]) || '•'
