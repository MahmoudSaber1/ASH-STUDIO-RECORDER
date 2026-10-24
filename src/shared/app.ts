import type { AppPlatform } from './platform'

export interface AppInfo {
  name: string
  version: string
  platform: AppPlatform
  arch: string
  isPackaged: boolean
}
