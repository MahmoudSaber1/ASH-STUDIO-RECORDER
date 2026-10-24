import { desktopCapturer, shell, systemPreferences } from 'electron'
import type { PermissionKind, PermissionState, PlatformCapabilities } from '@shared/platform'
import { BasePlatformService } from './base'

const SETTINGS_URLS: Record<PermissionKind, string> = {
  screen: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
  accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
  camera: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Camera',
  microphone: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone'
}

export class DarwinPlatformService extends BasePlatformService {
  readonly capabilities: PlatformCapabilities = {
    platform: 'darwin',
    requiresScreenRecordingPermission: true,
    requiresAccessibilityPermission: true,
    supportsSystemAudioCapture: false,
    supportsWindowCapture: true,
    supportsGlobalInputHooks: true
  }

  getPermissions(): PermissionState[] {
    const screen = systemPreferences.getMediaAccessStatus('screen')
    const accessibilityGranted = systemPreferences.isTrustedAccessibilityClient(false)
    const camera = systemPreferences.getMediaAccessStatus('camera')
    const microphone = systemPreferences.getMediaAccessStatus('microphone')

    return [
      this.permission('screen', screen, true),
      this.permission('accessibility', accessibilityGranted ? 'granted' : 'denied', true),
      this.permission('camera', camera, false),
      this.permission('microphone', microphone, false)
    ]
  }

  async requestPermission(kind: PermissionKind): Promise<PermissionState[]> {
    switch (kind) {
      case 'screen': {
        if (systemPreferences.getMediaAccessStatus('screen') === 'not-determined') {
          await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width: 0, height: 0 }
          })
        }
        if (systemPreferences.getMediaAccessStatus('screen') !== 'granted') {
          await this.openPermissionSettings('screen')
        }
        break
      }
      case 'accessibility': {
        systemPreferences.isTrustedAccessibilityClient(true)
        await this.openPermissionSettings('accessibility')
        break
      }
      case 'camera':
      case 'microphone': {
        if (systemPreferences.getMediaAccessStatus(kind) === 'not-determined') {
          await systemPreferences.askForMediaAccess(kind)
        }
        if (systemPreferences.getMediaAccessStatus(kind) !== 'granted') {
          await this.openPermissionSettings(kind)
        }
        break
      }
    }

    return this.getPermissions()
  }

  async openPermissionSettings(kind: PermissionKind): Promise<boolean> {
    try {
      await shell.openExternal(SETTINGS_URLS[kind])
      return true
    } catch (error) {
      console.error('[platform] failed to open macOS privacy settings', error)
      return false
    }
  }
}
