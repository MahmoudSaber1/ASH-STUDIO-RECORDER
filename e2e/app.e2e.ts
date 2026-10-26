import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page
} from '@playwright/test'
import ffmpegPath from 'ffmpeg-static'
import { makeFixture } from './make-fixture.mjs'

const REPO = resolve(__dirname, '..')
const PROJECT_NAME = 'Fixture demo'

let recordings: string
let app: ElectronApplication
let page: Page
let outputDir: string

const mainWindow = async (electronApp: ElectronApplication): Promise<Page> => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const window = electronApp.windows().find((item) => !item.url().includes('#toolbar'))
    if (window) return window
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('The main window never appeared')
}

test.beforeAll(async () => {
  recordings = mkdtempSync(join(tmpdir(), 'ash-e2e-recordings-'))
  outputDir = mkdtempSync(join(tmpdir(), 'ash-e2e-out-'))
  makeFixture(recordings, PROJECT_NAME)

  // ASH_E2E_APP points at a packaged build (for example release/mac-arm64/... .app)
  // so the same suite can verify the shipped artifact, not just the dev output.
  const packaged = process.env['ASH_E2E_APP']
  app = await electron.launch({
    ...(packaged ? { executablePath: packaged } : { args: [join(REPO, 'out/main/index.js')] }),
    cwd: REPO,
    env: { ...process.env, ASH_RECORDINGS_DIR: recordings, NODE_ENV: 'production' }
  })

  // Native dialogs cannot be driven from the test; route them to fixed paths.
  await app.evaluate(({ dialog }, out) => {
    dialog.showSaveDialog = () =>
      Promise.resolve({ canceled: false, filePath: `${out}/export.mp4` })
  }, outputDir)

  // The app also creates a hidden toolbar window, so pick the main window explicitly.
  page = await mainWindow(app)
  await page.waitForLoadState('domcontentloaded')
})

test.afterAll(async () => {
  await app?.close()
  rmSync(recordings, { recursive: true, force: true })
  rmSync(outputDir, { recursive: true, force: true })
})

test('opens the projects library and lists the fixture project', async () => {
  await page.getByRole('button', { name: 'Skip for now' }).click()
  await page.getByRole('button', { name: 'Projects' }).click()
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()
  await expect(page.getByRole('heading', { name: PROJECT_NAME })).toBeVisible()
})

test('opens the editor and detects zoom from clicks', async () => {
  await page.getByRole('button', { name: 'Open' }).first().click()
  await expect(page.getByRole('slider', { name: 'Timeline' })).toBeVisible()
  await expect(page.getByLabel('Preview', { exact: true })).toBeVisible()

  // Zoom is generated from clicks the first time a project opens.
  await expect(page.getByRole('button', { name: /\d(\.\d)?×/ }).first()).toBeVisible()

  await page.getByRole('tab', { name: 'Zoom' }).click()
  await page.getByRole('button', { name: 'Detect from clicks' }).click()
  await expect(page.getByRole('status')).toContainText(/Found \d+ zoom segment/)
})

test('speeds up a selected range from the Speed tab and undoes it', async () => {
  const slider = page.getByRole('slider', { name: 'Timeline' })
  await expect(slider).toHaveAttribute('aria-valuemax', /\d+/)

  // Select a range by dragging on the timeline.
  // The detected-zoom notice pushes the timeline down, so bring it into view first.
  await slider.scrollIntoViewIfNeeded()
  const box = await slider.boundingBox()
  if (!box) throw new Error('timeline is not visible')
  await page.mouse.move(box.x + 180, box.y + 40)
  await page.mouse.down()
  await page.mouse.move(box.x + 320, box.y + 40, { steps: 8 })
  await page.mouse.up()

  await page.getByRole('tab', { name: 'Speed' }).click()
  await page.getByRole('button', { name: '2×', exact: true }).first().click()
  const ramp = page.getByTitle('Click to remove this speed change')
  await expect(ramp).toHaveCount(1)

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(ramp).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Redo' })).toBeEnabled()
})

test('saves edits and reopens with the same zoom segments', async () => {
  await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 10_000 })
  await page
    .getByRole('button', { name: /Projects/ })
    .first()
    .click()
  await page.getByRole('button', { name: 'Open' }).first().click()
  await expect(page.getByRole('slider', { name: 'Timeline' })).toBeVisible()
  await expect(page.getByRole('button', { name: /\d(\.\d)?×/ }).first()).toBeVisible()
})

/**
 * Reads a small patch at the center of the face cam in the preview canvas. The
 * position follows the default layout: 6% padding and an 18% face cam at the
 * bottom right of a 16:9 frame.
 */
const sampleFaceCam = (target: Page): Promise<number[]> =>
  target.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('canvas[aria-label="Preview"]')
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return []
    const x = Math.round(canvas.width * 0.7733) - 8
    const y = Math.round(canvas.height * 0.68) - 8
    return Array.from(ctx.getImageData(x, y, 16, 16).data)
  })

test('plays the face cam with the video instead of a frozen frame', async () => {
  await page.getByRole('tab', { name: 'Face cam' }).click()
  await page.getByLabel('Show face cam').check()
  await page.getByRole('button', { name: 'Go to start' }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()

  await page.waitForTimeout(700)
  const first = await sampleFaceCam(page)
  await page.waitForTimeout(1200)
  const second = await sampleFaceCam(page)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()

  expect(first.length).toBeGreaterThan(0)
  expect(second).not.toEqual(first)
})

test('exports an MP4 with the chosen resolution', async () => {
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Export video' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('combobox').first().selectOption('mp4')
  await dialog.getByRole('combobox').nth(1).selectOption('720p')
  await dialog.getByRole('button', { name: 'Export', exact: true }).click()
  await expect(dialog.getByText(/Saved to/)).toBeVisible({ timeout: 120_000 })

  const output = join(outputDir, 'export.mp4')
  expect(statSync(output).size).toBeGreaterThan(1000)
  // `ffmpeg -i` with no output exits non-zero but prints the stream details to stderr.
  const probe = spawnSync(ffmpegPath, ['-i', output], { encoding: 'utf8' }).stderr
  expect(probe).toMatch(/Video: h264/)
  expect(probe).toMatch(/1280x720/)
  await dialog.getByRole('button', { name: 'Close' }).click()
})

test('settings screen shows the recordings folder used by the tests', async () => {
  // The editor has its own back button; the top-level tabs live on the library screen.
  await page.getByRole('button', { name: '← Projects' }).click()
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await expect(page.getByText(recordings)).toBeVisible()
})
