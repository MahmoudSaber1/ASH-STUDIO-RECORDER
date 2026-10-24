import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const electronInstaller = 'node_modules/electron/install.js'
const skip = process.env.ELECTRON_SKIP_BINARY_DOWNLOAD === '1'

if (!skip && existsSync(electronInstaller)) {
  const result = spawnSync(process.execPath, [electronInstaller], { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
