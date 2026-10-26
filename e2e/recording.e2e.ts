import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { _electron as electron, expect, test, type Page } from '@playwright/test'

/**
 * Records the real screen for a few seconds with a fake camera, so it is opt-in:
 * ASH_E2E_RECORD=1 npm run test:e2e
 * Needs Screen Recording permission for the app that runs the test.
 */
test.skip(!process.env['ASH_E2E_RECORD'], 'Set ASH_E2E_RECORD=1 to run the live recording test')

test('records with the camera bubble visible, then closes it', async () => {
  const recordings = mkdtempSync(join(tmpdir(), 'ash-e2e-record-'))
  const app = await electron.launch({
    args: [
      join(resolve(__dirname, '..'), 'out/main/index.js'),
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream'
    ],
    env: { ...process.env, ASH_RECORDINGS_DIR: recordings }
  })

  try {
    let page: Page | undefined
    for (let attempt = 0; attempt < 100 && !page; attempt += 1) {
      page = app.windows().find((item) => !item.url().includes('#'))
      if (!page) await new Promise((done) => setTimeout(done, 100))
    }
    if (!page) throw new Error('The main window never appeared')

    await page.getByRole('button', { name: 'Skip for now' }).click()
    await page.getByRole('switch', { name: 'Camera' }).click()
    await expect(page.getByRole('switch', { name: 'Camera' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    await page.getByRole('button', { name: 'Off' }).click()
    await page.getByRole('button', { name: /Start recording/ }).click()

    const bubble = await app.waitForEvent('window', {
      predicate: (window) => window.url().includes('#camera'),
      timeout: 15_000
    })
    await expect
      .poll(() => bubble.evaluate(() => document.querySelector('video')?.videoWidth ?? 0))
      .toBeGreaterThan(0)

    await page.waitForTimeout(1500)
    await page.evaluate(() => window.api.recorder.stop())
    await expect
      .poll(
        () => page.evaluate(() => window.api.recorder.getState().then((state) => state.phase)),
        {
          timeout: 20_000
        }
      )
      .toBe('completed')

    expect(app.windows().some((window) => window.url().includes('#camera'))).toBe(false)
    const [project] = readdirSync(recordings)
    expect(project).toBeTruthy()
    expect(readdirSync(join(recordings, project ?? ''))).toEqual(
      expect.arrayContaining(['project.json', 'screen.webm', 'webcam.webm', 'events.jsonl'])
    )
  } finally {
    await app.close()
    rmSync(recordings, { recursive: true, force: true })
  }
})
