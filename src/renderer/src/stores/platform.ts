import { create } from 'zustand'
import type { AppInfo } from '@shared/app'
import type {
  CaptureSource,
  PermissionKind,
  PermissionState,
  PlatformCapabilities
} from '@shared/platform'

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

interface PlatformStore {
  appInfo: AppInfo | null
  capabilities: PlatformCapabilities | null
  permissions: PermissionState[]
  sources: CaptureSource[]
  status: LoadStatus
  error: string | null
  pendingKind: PermissionKind | null
  load: () => Promise<void>
  refreshPermissions: () => Promise<void>
  refreshSources: () => Promise<void>
  requestPermission: (kind: PermissionKind) => Promise<void>
  openPermissionSettings: (kind: PermissionKind) => Promise<void>
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unable to read platform state.'

const screenGranted = (permissions: PermissionState[]): boolean =>
  permissions.some((permission) => permission.kind === 'screen' && permission.status === 'granted')

export const usePlatformStore = create<PlatformStore>((set, get) => ({
  appInfo: null,
  capabilities: null,
  permissions: [],
  sources: [],
  status: 'idle',
  error: null,
  pendingKind: null,

  load: async () => {
    set({ status: 'loading', error: null })
    try {
      const [appInfo, capabilities, permissions] = await Promise.all([
        window.api.app.getInfo(),
        window.api.platform.getCapabilities(),
        window.api.platform.getPermissions()
      ])

      set({ appInfo, capabilities, permissions, status: 'ready' })

      if (screenGranted(permissions)) {
        await get().refreshSources()
      }
    } catch (error) {
      set({ status: 'error', error: errorMessage(error) })
    }
  },

  refreshPermissions: async () => {
    try {
      const permissions = await window.api.platform.getPermissions()
      set({ permissions, error: null })

      if (screenGranted(permissions)) {
        await get().refreshSources()
      } else {
        set({ sources: [] })
      }
    } catch (error) {
      set({ error: errorMessage(error) })
    }
  },

  refreshSources: async () => {
    try {
      const sources = await window.api.platform.getSources({
        kinds: ['screen', 'window'],
        thumbnails: false,
        fetchWindowIcons: false
      })
      set({ sources })
    } catch {
      set({ sources: [] })
    }
  },

  requestPermission: async (kind) => {
    set({ pendingKind: kind, error: null })
    try {
      const permissions = await window.api.platform.requestPermission(kind)
      set({ permissions })

      if (kind === 'screen') {
        await get().refreshSources()
      }
    } catch (error) {
      set({ error: errorMessage(error) })
    } finally {
      set({ pendingKind: null })
    }
  },

  openPermissionSettings: async (kind) => {
    set({ pendingKind: kind, error: null })
    try {
      await window.api.platform.openPermissionSettings(kind)
    } catch (error) {
      set({ error: errorMessage(error) })
    } finally {
      set({ pendingKind: null })
    }
  }
}))
