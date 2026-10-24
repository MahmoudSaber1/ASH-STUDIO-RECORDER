import { DarwinPlatformService } from './darwin'
import { LinuxPlatformService } from './linux'
import type { PlatformService } from './service'
import { WindowsPlatformService } from './win32'

export type { PlatformService } from './service'

export const createPlatformService = (): PlatformService => {
  switch (process.platform) {
    case 'darwin':
      return new DarwinPlatformService()
    case 'win32':
      return new WindowsPlatformService()
    default:
      return new LinuxPlatformService()
  }
}
