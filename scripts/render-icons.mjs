// Renders the logo SVGs to PNG with Electron's own Chromium, so no image tools
// are needed. Run: npx electron scripts/render-icons.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, nativeImage } from 'electron'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const glyph = readFileSync(join(root, 'build/logo-glyph.svg'), 'utf8')
  .replace(/^<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '')

// One window renders every icon: some sandboxed environments refuse a second renderer.
let window = null

const LIME_TOP = '#a6ea00'
const LIME_BOTTOM = '#75e900'

/** App icon: lime squircle (the brand's gradient) with the black mascot screen. */
const appIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${LIME_TOP}"/><stop offset="1" stop-color="${LIME_BOTTOM}"/>
  </linearGradient></defs>
  <rect x="100" y="100" width="824" height="824" rx="186" fill="url(#g)"/>
  <g transform="translate(512 512) scale(0.74) translate(-512 -512)" style="color:#000; --cutout:${LIME_TOP}">${glyph}</g>
</svg>`

/** Menu bar template: black glyph on transparent, cut-outs punched out. */
const trayIcon = (
  size
) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="150 200 724 660" width="${size}" height="${size}">
  <defs><mask id="m"><rect x="0" y="0" width="1024" height="1024" fill="#000"/>
    <g style="color:#000; --cutout:#000">${glyph.replace(/fill="currentColor"/g, 'fill="#fff"')}</g>
  </mask></defs>
  <rect x="0" y="0" width="1024" height="1024" fill="#000" mask="url(#m)"/>
</svg>`

const capture = async (svg, size, background) => {
  const html = `<html><body style="margin:0;background:${background}">${svg}</body></html>`
  const page = join(tmpdir(), `ash-icon-${size}.html`)
  writeFileSync(page, html)
  await window.loadFile(page)
  await new Promise((resolve) => setTimeout(resolve, 300))
  const image = await window.webContents.capturePage({ x: 0, y: 0, width: size, height: size })
  return image.resize({ width: size, height: size }).toBitmap()
}

/**
 * Offscreen captures have no alpha channel, so each icon is drawn on black and on
 * white, and transparency is recovered from the difference between the two.
 */
const render = async (svg, size, file) => {
  window ??= new BrowserWindow({
    width: 1024,
    height: 1024,
    show: false,
    frame: false,
    webPreferences: { offscreen: true }
  })
  const onBlack = await capture(svg, size, '#000')
  const onWhite = await capture(svg, size, '#fff')
  const out = Buffer.alloc(onBlack.length)
  for (let i = 0; i < onBlack.length; i += 4) {
    let difference = 0
    for (let c = 0; c < 3; c += 1) difference += onWhite[i + c] - onBlack[i + c]
    const alpha = Math.min(1, Math.max(0, 1 - difference / (3 * 255)))
    for (let c = 0; c < 3; c += 1) {
      out[i + c] = alpha > 0 ? Math.min(255, Math.round(onBlack[i + c] / alpha)) : 0
    }
    out[i + 3] = Math.round(alpha * 255)
  }
  writeFileSync(file, nativeImage.createFromBitmap(out, { width: size, height: size }).toPNG())
}

app.whenReady().then(async () => {
  await render(appIcon, 1024, join(root, 'build/icon.png'))
  await render(trayIcon(18), 18, join(root, 'build/trayTemplate.png'))
  await render(trayIcon(36), 36, join(root, 'build/trayTemplate@2x.png'))
  writeFileSync(join(root, 'build/icon.svg'), appIcon)
  window?.destroy()
  app.quit()
})
