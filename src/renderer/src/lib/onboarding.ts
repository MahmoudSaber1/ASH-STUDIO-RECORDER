const KEY = 'ash.onboarding.completed'

/** First-run setup is shown until the user finishes it once on this machine. */
export const isOnboardingDone = (): boolean => {
  try {
    return window.localStorage.getItem(KEY) === 'true'
  } catch {
    return false
  }
}

export const markOnboardingDone = (): void => {
  try {
    window.localStorage.setItem(KEY, 'true')
  } catch {
    // Setup shows again next launch; nothing else depends on it.
  }
}

const STEP_KEY = 'ash.onboarding.step'

/**
 * The permission step can restart the app (macOS needs that), so setup resumes
 * at that step instead of starting over from the welcome screen.
 */
export const getSavedOnboardingStep = (): 'welcome' | 'setup' => {
  try {
    return window.localStorage.getItem(STEP_KEY) === 'setup' ? 'setup' : 'welcome'
  } catch {
    return 'welcome'
  }
}

export const saveOnboardingStep = (step: 'welcome' | 'setup'): void => {
  try {
    window.localStorage.setItem(STEP_KEY, step)
  } catch {
    // Resuming is a convenience only.
  }
}
