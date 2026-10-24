import type { PermissionKind, PermissionState, PlatformCapabilities } from '@shared/platform'
import { BasePlatformService } from './base'

export class LinuxPlatformService extends BasePlatformService {
  readonly capabilities: PlatformCapabilities = {
    platform: 'linux',
    requiresScreenRecordingPermission: false,
    requiresAccessibilityPermission: false,
    supportsSystemAudioCapture: false,
    supportsWindowCapture: true,
    supportsGlobalInputHooks: false
  }

  getPermissions(): PermissionState[] {
    return [
      this.permission('screen', 'granted', true),
      this.permission('camera', 'unknown', false),
      this.permission('microphone', 'unknown', false)
    ]
  }

  requestPermission(_kind: PermissionKind): Promise<PermissionState[]> {
    return Promise.resolve(this.getPermissions())
  }

  openPermissionSettings(_kind: PermissionKind): Promise<boolean> {
    return Promise.resolve(false)
  }
}
