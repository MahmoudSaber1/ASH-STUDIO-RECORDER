export type ThemePreference = 'system' | 'dark' | 'light'

const KEY = 'ash.theme'
const query = (): MediaQueryList | null =>
  typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: light)')
    : null

export const getThemePreference = (): ThemePreference => {
  try {
    const value = window.localStorage.getItem(KEY)
    return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
  } catch {
    return 'system'
  }
}

const resolve = (preference: ThemePreference): 'dark' | 'light' =>
  preference === 'system' ? (query()?.matches ? 'light' : 'dark') : preference

/** Sets `data-theme` on the root element, which the light-mode tokens key off. */
export const applyTheme = (preference: ThemePreference = getThemePreference()): void => {
  document.documentElement.dataset['theme'] = resolve(preference)
}

export const setThemePreference = (preference: ThemePreference): void => {
  try {
    window.localStorage.setItem(KEY, preference)
  } catch {
    // The theme still applies for this session.
  }
  applyTheme(preference)
}

/** Follows the OS appearance while the preference is "system". */
export const watchSystemTheme = (): void => {
  query()?.addEventListener('change', () => {
    if (getThemePreference() === 'system') applyTheme('system')
  })
}
