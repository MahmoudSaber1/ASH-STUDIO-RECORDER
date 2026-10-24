import type { AppPlatform, PermissionKind } from '@shared/platform'

interface PermissionMeta {
  title: string
  description: string
}

export const PERMISSION_META: Record<PermissionKind, PermissionMeta> = {
  screen: {
    title: 'Screen recording',
    description: 'Captures your display or a single window. Without this there is nothing to edit.'
  },
  accessibility: {
    title: 'Accessibility',
    description: 'Tracks cursor position, clicks, and scrolls so the editor can replay them.'
  },
  camera: {
    title: 'Camera',
    description: 'Optional. Records a face cam that you can shape and place in the editor.'
  },
  microphone: {
    title: 'Microphone',
    description: 'Optional. Records your voice on its own audio track.'
  }
}

export const permissionGuidance = (
  kind: PermissionKind,
  platform: AppPlatform | undefined
): string[] => {
  if (platform === 'darwin') {
    switch (kind) {
      case 'screen':
        return [
          'Open System Settings → Privacy & Security → Screen & System Audio Recording.',
          'Turn on Ash Studio Recorder.',
          'Quit and reopen the app so the new permission takes effect.'
        ]
      case 'accessibility':
        return [
          'Open System Settings → Privacy & Security → Accessibility.',
          'Turn on Ash Studio Recorder.',
          'Quit and reopen the app so input tracking can start.'
        ]
      case 'camera':
        return [
          'Open System Settings → Privacy & Security → Camera.',
          'Turn on Ash Studio Recorder.'
        ]
      case 'microphone':
        return [
          'Open System Settings → Privacy & Security → Microphone.',
          'Turn on Ash Studio Recorder.'
        ]
    }
  }

  if (platform === 'win32') {
    switch (kind) {
      case 'screen':
        return [
          'Windows does not require a screen recording permission.',
          'If capture fails, check Settings → Privacy & security → App permissions.'
        ]
      case 'camera':
        return [
          'Open Settings → Privacy & security → Camera.',
          'Allow desktop apps to access your camera.'
        ]
      case 'microphone':
        return [
          'Open Settings → Privacy & security → Microphone.',
          'Allow desktop apps to access your microphone.'
        ]
      case 'accessibility':
        return ['No extra permission is needed on Windows.']
    }
  }

  return ['Permission prompts depend on your desktop environment.']
}

export const formatPermissionStatus = (status: string): string => {
  switch (status) {
    case 'granted':
      return 'Granted'
    case 'denied':
      return 'Not granted'
    case 'restricted':
      return 'Restricted'
    case 'not-determined':
      return 'Not requested'
    case 'unavailable':
      return 'Unavailable'
    default:
      return 'Unknown'
  }
}
