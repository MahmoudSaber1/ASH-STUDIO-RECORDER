import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// NSIS assisted installer bitmaps must be uncompressed 24-bit RGB with no alpha.
// Generate them with Node so Windows CI can build without graphics dependencies.
const root = fileURLToPath(new URL('..', import.meta.url))
const output = join(root, 'build')
mkdirSync(output, { recursive: true })

const clamp = (value) => Math.max(0, Math.min(255, Math.round(value)))
const mix = (a, b, t) => a.map((value, index) => clamp(value + (b[index] - value) * t))

function paint(width, height, pixel) {
  const stride = (width * 3 + 3) & ~3
  const data = Buffer.alloc(54 + stride * height)
  data.write('BM', 0)
  data.writeUInt32LE(data.length, 2)
  data.writeUInt32LE(54, 10)
  data.writeUInt32LE(40, 14)
  data.writeInt32LE(width, 18)
  data.writeInt32LE(height, 22)
  data.writeUInt16LE(1, 26)
  data.writeUInt16LE(24, 28)
  data.writeUInt32LE(stride * height, 34)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = pixel(x, y, width, height)
      const index = 54 + (height - y - 1) * stride + x * 3
      data[index] = clamp(b)
      data[index + 1] = clamp(g)
      data[index + 2] = clamp(r)
    }
  }
  return data
}

const insideRounded = (x, y, left, top, width, height, radius) => {
  const cx = Math.max(left + radius, Math.min(x, left + width - radius))
  const cy = Math.max(top + radius, Math.min(y, top + height - radius))
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2
}

function limeMark(x, y, size) {
  const sx = (x - 24) / size
  const sy = (y - 48) / size
  if (sx < 0 || sy < 0 || sx > 1 || sy > 1) return null
  if (!insideRounded(x, y, 24, 48, size, size, size * 0.2)) return null
  const dark = [12, 37, 28]
  const lime = [26, 191, 115]
  const screen = sx > 0.2 && sx < 0.8 && sy > 0.25 && sy < 0.7
  const play = sx > 0.43 && sx < 0.65 && Math.abs(sy - 0.48) < (sx - 0.42) * 0.8
  if (play) return [234, 255, 246]
  if (screen && !play) return dark
  return lime
}

function sidebar(x, y, width, height) {
  const accent = [24, 177, 112]
  const light = [247, 251, 249]
  const soft = [228, 245, 235]
  const t = y / height
  let color = mix(light, soft, t * 0.46)
  const wave = 32 * Math.sin((x / width) * Math.PI * 1.5 + t * 2)
  if (y > height * 0.67 + wave) color = mix(color, [198, 235, 216], Math.min(0.7, (y / height - 0.6)))
  const mark = limeMark(x, y, 116)
  if (mark) color = mark
  if (y >= 211 && y <= 215 && x >= 24 && x < 76) color = accent
  if (y > 270 && y < 276 && x >= 24 && x < 140) color = [190, 220, 207]
  if (y > 284 && y < 290 && x >= 24 && x < 115) color = [204, 231, 216]
  return color
}

function header(x, y, width, height) {
  const base = mix([249, 253, 251], [228, 248, 237], x / width)
  if (y > height - 3) return [35, 187, 121]
  const badgeX = width - 48
  const badgeY = 11
  if (insideRounded(x, y, badgeX, badgeY, 36, 36, 9)) {
    if (x > badgeX + 9 && x < badgeX + 27 && y > badgeY + 8 && y < badgeY + 28) {
      if (x > badgeX + 14 && x < badgeX + 23 && Math.abs(y - (badgeY + 18)) < (x - badgeX - 13) * 0.85) {
        return [240, 255, 247]
      }
      return [19, 68, 48]
    }
    return [27, 194, 116]
  }
  return base
}

const images = [
  ['installerSidebar.bmp', 164, 314, sidebar],
  ['uninstallerSidebar.bmp', 164, 314, sidebar],
  ['installerHeader.bmp', 150, 57, header]
]
for (const [name, width, height, draw] of images) {
  const target = join(output, name)
  writeFileSync(target, paint(width, height, draw))
  process.stdout.write(`Generated ${name} (${width}x${height}, 24-bit BMP)\n`)
}
