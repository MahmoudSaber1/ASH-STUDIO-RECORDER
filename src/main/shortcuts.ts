import { globalShortcut } from 'electron'

export const START_SHORTCUT = 'CommandOrControl+Shift+R'
export const PAUSE_SHORTCUT = 'CommandOrControl+Shift+P'
export const STOP_SHORTCUT = 'CommandOrControl+Shift+S'

/** Returns the accelerators that could not be registered, so callers can report them. */
const register = (accelerator: string, handler: () => void): string[] =>
  globalShortcut.register(accelerator, handler) ? [] : [accelerator]

export const registerStartShortcut = (handler: () => void): string[] =>
  register(START_SHORTCUT, handler)

export const unregisterStartShortcut = (): void => {
  globalShortcut.unregister(START_SHORTCUT)
}

export const registerSessionShortcuts = (handlers: {
  togglePause: () => void
  stop: () => void
}): string[] => [
  ...register(PAUSE_SHORTCUT, handlers.togglePause),
  ...register(STOP_SHORTCUT, handlers.stop)
]

export const unregisterSessionShortcuts = (): void => {
  globalShortcut.unregister(PAUSE_SHORTCUT)
  globalShortcut.unregister(STOP_SHORTCUT)
}

export const unregisterAllShortcuts = (): void => {
  globalShortcut.unregisterAll()
}
