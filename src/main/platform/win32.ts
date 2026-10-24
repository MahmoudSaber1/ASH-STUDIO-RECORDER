import { shell, systemPreferences } from 'electron'
import type { PermissionKind, PermissionState, PlatformCapabilities } from '@shared/platform'
import { BasePlatformService } from './base'

const SETTINGS_URLS: Partial<Record<PermissionKind, string>> = {
  camera: 'ms-settings:privacy-webcam',
  microphone: 'ms-settings:privacy-microphone'
}

export class WindowsPlatformService extends BasePlatformService {
  readonly capabilities: PlatformCapabilities = {
    platform: 'win32',
    requiresScreenRecordingPermission: false,
    requiresAccessibilityPermission: false,
    supportsSystemAudioCapture: true,
    supportsWindowCapture: true,
    supportsGlobalInputHooks: true
  }

  getPermissions(): PermissionState[] {
    return [
      this.permission('screen', 'granted', true),
      this.permission('camera', this.mediaStatus('camera'), false),
      this.permission('microphone', this.mediaStatus('microphone'), false)
    ]
  }

  async requestPermission(kind: PermissionKind): Promise<PermissionState[]> {
    if (kind === 'screen') return this.getPermissions()

    await this.openPermissionSettings(kind)
    return this.getPermissions()
  }

  async openPermissionSettings(kind: PermissionKind): Promise<boolean> {
    const url = SETTINGS_URLS[kind]
    if (!url) return false

    try {
      await shell.openExternal(url)
      return true
    } catch (error) {
      console.error('[platform] failed to open Windows privacy settings', error)
      return false
    }
  }

  private mediaStatus(kind: 'camera' | 'microphone'): PermissionState['status'] {
    try {
      return systemPreferences.getMediaAccessStatus(kind)
    } catch {
      return 'unknown'
    }
  }
}
