import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))

describe('Modern Light NSIS assets', () => {
  it('generates valid 24-bit artwork in NSIS assisted-installer dimensions', () => {
    execFileSync(process.execPath, [join(root, 'scripts/generate-installer-artwork.mjs')])

    for (const [name, width, height] of [
      ['installerSidebar.bmp', 164, 314],
      ['uninstallerSidebar.bmp', 164, 314],
      ['installerHeader.bmp', 150, 57]
    ]) {
      const data = readFileSync(join(root, 'build', name))
      expect(data.toString('ascii', 0, 2)).toBe('BM')
      expect(data.readUInt32LE(2)).toBe(data.length)
      expect(data.readUInt32LE(10)).toBe(54)
      expect(data.readUInt32LE(14)).toBe(40)
      expect(data.readInt32LE(18)).toBe(width)
      expect(data.readInt32LE(22)).toBe(height)
      expect(data.readUInt16LE(26)).toBe(1)
      expect(data.readUInt16LE(28)).toBe(24)
    }
  })
})
