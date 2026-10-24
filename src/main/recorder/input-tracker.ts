import {
  uIOhook,
  type UiohookKeyboardEvent,
  type UiohookMouseEvent,
  type UiohookWheelEvent
} from 'uiohook-napi'
import type { RecorderInputEvent } from '@shared/ipc'

const MOVE_THROTTLE_MS = 16

export interface InputTrackerOptions {
  logKeys: boolean
  clock: () => number
  onEvent: (event: RecorderInputEvent) => void
}

/**
 * Host-wide mouse/keyboard hook. Runs only in the main process; the renderer
 * never sees raw OS input. Mouse moves are throttled to roughly 60 Hz.
 *
 * The keyboard hook is only attached when keystroke logging is enabled, so the
 * app never listens to keys the user did not opt in to.
 */
export class InputTracker {
  private active = false
  private lastMoveAt = 0

  constructor(private readonly options: InputTrackerOptions) {}

  private readonly handleMove = (event: UiohookMouseEvent): void => {
    const now = Date.now()
    if (now - this.lastMoveAt < MOVE_THROTTLE_MS) return
    this.lastMoveAt = now
    this.emit({ type: 'mousemove', x: event.x, y: event.y })
  }

  private readonly handleMouseDown = (event: UiohookMouseEvent): void => {
    this.emit({
      type: 'mousedown',
      x: event.x,
      y: event.y,
      button: this.buttonOf(event),
      clicks: event.clicks
    })
  }

  private readonly handleMouseUp = (event: UiohookMouseEvent): void => {
    this.emit({
      type: 'mouseup',
      x: event.x,
      y: event.y,
      button: this.buttonOf(event),
      clicks: event.clicks
    })
  }

  private readonly handleWheel = (event: UiohookWheelEvent): void => {
    this.emit({
      type: 'wheel',
      x: event.x,
      y: event.y,
      direction: event.direction,
      rotation: event.rotation
    })
  }

  private readonly handleKeyDown = (event: UiohookKeyboardEvent): void => {
    this.emit({ type: 'keydown', keycode: event.keycode })
  }

  private readonly handleKeyUp = (event: UiohookKeyboardEvent): void => {
    this.emit({ type: 'keyup', keycode: event.keycode })
  }

  private buttonOf(event: UiohookMouseEvent): number | undefined {
    return typeof event.button === 'number' ? event.button : undefined
  }

  private emit(event: Omit<RecorderInputEvent, 't'>): void {
    this.options.onEvent({ t: Math.max(0, this.options.clock()), ...event })
  }

  private attach(): void {
    uIOhook.on('mousemove', this.handleMove)
    uIOhook.on('mousedown', this.handleMouseDown)
    uIOhook.on('mouseup', this.handleMouseUp)
    uIOhook.on('wheel', this.handleWheel)

    if (this.options.logKeys) {
      uIOhook.on('keydown', this.handleKeyDown)
      uIOhook.on('keyup', this.handleKeyUp)
    }
  }

  private detach(): void {
    uIOhook.off('mousemove', this.handleMove)
    uIOhook.off('mousedown', this.handleMouseDown)
    uIOhook.off('mouseup', this.handleMouseUp)
    uIOhook.off('wheel', this.handleWheel)
    uIOhook.off('keydown', this.handleKeyDown)
    uIOhook.off('keyup', this.handleKeyUp)
  }

  start(): boolean {
    if (this.active) return true

    this.attach()

    try {
      uIOhook.start()
      this.active = true
      return true
    } catch (error) {
      this.detach()
      console.error('[recorder] global input hooks unavailable', error)
      return false
    }
  }

  stop(): void {
    if (!this.active) return
    this.active = false
    this.detach()

    try {
      uIOhook.stop()
    } catch (error) {
      console.error('[recorder] failed to stop global input hooks', error)
    }
  }
}
