import { app, desktopCapturer, screen, type Display, type DesktopCapturerSource } from 'electron'
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

/** Shell and system surfaces that show up as windows but are never useful to record. */
const SYSTEM_WINDOW_NAMES = new Set([
  'Program Manager',
  'Windows Input Experience',
  'Dock',
  'Window Server',
  'Control Center',
  'Notification Center'
])

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

    const displays = screen.getAllDisplays()

    return sources
      .filter((source) => this.isRecordable(source, withThumbnails))
      .map((source) => this.toCaptureSource(source, displays, withThumbnails, withIcons))
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

  /**
   * Drops windows that cannot usefully be recorded: unnamed ones, the shell,
   * this app's own window, and windows with no thumbnail (minimized or hidden).
   */
  private isRecordable(source: DesktopCapturerSource, withThumbnail: boolean): boolean {
    if (this.isScreen(source)) return true

    const name = source.name.trim()
    if (!name) return false
    if (name === app.getName() || SYSTEM_WINDOW_NAMES.has(name)) return false
    if (withThumbnail && source.thumbnail.isEmpty()) return false

    return true
  }

  private isScreen(source: DesktopCapturerSource): boolean {
    return source.id.startsWith('screen:')
  }

  private displayLabel(source: DesktopCapturerSource, displays: Display[]): string {
    const index = displays.findIndex((display) => String(display.id) === source.display_id)
    const display = displays[index]
    if (!display) return source.name

    const width = Math.round(display.bounds.width * display.scaleFactor)
    const height = Math.round(display.bounds.height * display.scaleFactor)
    const main = display.id === screen.getPrimaryDisplay().id ? ' (main)' : ''

    return `Display ${index + 1} · ${width}×${height}${main}`
  }

  private toCaptureSource(
    source: DesktopCapturerSource,
    displays: Display[],
    withThumbnail: boolean,
    withIcon: boolean
  ): CaptureSource {
    const thumbnail =
      withThumbnail && !source.thumbnail.isEmpty() ? source.thumbnail.toDataURL() : undefined
    const appIcon =
      withIcon && source.appIcon && !source.appIcon.isEmpty()
        ? source.appIcon.toDataURL()
        : undefined
    const isScreen = this.isScreen(source)

    return {
      id: source.id,
      name: isScreen ? this.displayLabel(source, displays) : source.name.trim(),
      kind: isScreen ? 'screen' : 'window',
      ...(source.display_id ? { displayId: source.display_id } : {}),
      ...(thumbnail ? { thumbnail } : {}),
      ...(appIcon ? { appIcon } : {})
    }
  }
}
