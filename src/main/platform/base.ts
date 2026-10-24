import { desktopCapturer, screen, type DesktopCapturerSource } from 'electron'
import type {
  CaptureSource,
  CaptureSourceKind,
  CaptureSourcesOptions,
  PermissionKind,
  PermissionState,
  PermissionStatus,
  PlatformCapabilities,
  Point
} from '@shared/platform'
import type { PlatformService } from './service'

const MAX_THUMBNAIL_DIMENSION = 1024
const DEFAULT_THUMBNAIL_SIZE = { width: 320, height: 180 }

const clampDimension = (value: number): number => {
  if (!Number.isFinite(value)) return 0
  return Math.min(Math.max(Math.round(value), 0), MAX_THUMBNAIL_DIMENSION)
}

export abstract class BasePlatformService implements PlatformService {
  abstract readonly capabilities: PlatformCapabilities

  abstract getPermissions(): PermissionState[]
  abstract requestPermission(kind: PermissionKind): Promise<PermissionState[]>
  abstract openPermissionSettings(kind: PermissionKind): Promise<boolean>

  async getSources(options: CaptureSourcesOptions = {}): Promise<CaptureSource[]> {
    const kinds: CaptureSourceKind[] = options.kinds?.length ? options.kinds : ['screen', 'window']
    const withThumbnails = options.thumbnails ?? true
    const withIcons = withThumbnails && (options.fetchWindowIcons ?? true)
    const requestedSize = options.thumbnailSize ?? DEFAULT_THUMBNAIL_SIZE

    const sources = await desktopCapturer.getSources({
      types: kinds,
      thumbnailSize: withThumbnails
        ? {
            width: clampDimension(requestedSize.width),
            height: clampDimension(requestedSize.height)
          }
        : { width: 0, height: 0 },
      fetchWindowIcons: withIcons
    })

    return sources.map((source) => this.toCaptureSource(source, withThumbnails, withIcons))
  }

  async listWindows(): Promise<CaptureSource[]> {
    return this.getSources({ kinds: ['window'], thumbnails: false, fetchWindowIcons: false })
  }

  getCursorPosition(): Point {
    const { x, y } = screen.getCursorScreenPoint()
    return { x, y }
  }

  protected permission(
    kind: PermissionKind,
    status: PermissionStatus,
    required: boolean
  ): PermissionState {
    return { kind, status, required }
  }

  private toCaptureSource(
    source: DesktopCapturerSource,
    withThumbnail: boolean,
    withIcon: boolean
  ): CaptureSource {
    const thumbnail =
      withThumbnail && !source.thumbnail.isEmpty() ? source.thumbnail.toDataURL() : undefined
    const appIcon = withIcon && !source.appIcon.isEmpty() ? source.appIcon.toDataURL() : undefined

    return {
      id: source.id,
      name: source.name,
      kind: source.id.startsWith('screen:') ? 'screen' : 'window',
      ...(source.display_id ? { displayId: source.display_id } : {}),
      ...(thumbnail ? { thumbnail } : {}),
      ...(appIcon ? { appIcon } : {})
    }
  }
}
