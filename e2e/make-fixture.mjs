// Builds a small, realistic project folder for end-to-end tests: a screen
// track, a microphone track, an input event log, and a v1 manifest so the
// migration path is exercised too.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import ffmpegPath from 'ffmpeg-static'

export const makeFixture = (root, name = 'Fixture demo') => {
  const dir = join(root, name)
  mkdirSync(dir, { recursive: true })

  execFileSync(ffmpegPath, [
    '-y',
    '-v',
    'error',
    '-f',
    'lavfi',
    '-i',
    'testsrc=size=1280x720:rate=30:duration=8',
    '-c:v',
    'libvpx',
    '-b:v',
    '1M',
    join(dir, 'screen.webm')
  ])
  // testsrc2 animates everywhere, so a frozen face cam is easy to detect.
  execFileSync(ffmpegPath, [
    '-y',
    '-v',
    'error',
    '-f',
    'lavfi',
    '-i',
    'testsrc2=size=640x480:rate=30:duration=8',
    '-c:v',
    'libvpx',
    '-b:v',
    '600k',
    join(dir, 'webcam.webm')
  ])
  execFileSync(ffmpegPath, [
    '-y',
    '-v',
    'error',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:duration=8',
    '-c:a',
    'libopus',
    join(dir, 'microphone.webm')
  ])

  const events = []
  for (let t = 500; t < 7500; t += 100) {
    events.push({ t, type: 'mousemove', x: 200 + (t % 800), y: 150 + (t % 300) })
  }
  for (const t of [1000, 1200, 4000]) {
    events.push({ t, type: 'mousedown', x: 400, y: 300, button: 1, clicks: 1 })
    events.push({ t: t + 40, type: 'mouseup', x: 400, y: 300, button: 1, clicks: 1 })
  }
  events.push({ t: 5200, type: 'keydown', keycode: 0x001e })
  events.sort((a, b) => a.t - b.t)
  writeFileSync(
    join(dir, 'events.jsonl'),
    events.map((event) => JSON.stringify(event)).join('\n') + '\n'
  )

  const manifest = {
    schemaVersion: 1,
    id: name,
    app: { name: 'Ash Studio Recorder', version: '0.1.0' },
    status: 'completed',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:08.000Z',
    target: { id: 'screen:1:0', name: 'Display 1 · 1280×720', kind: 'screen', displayId: '1' },
    options: {
      fps: 30,
      captureWebcam: true,
      captureMicrophone: true,
      captureSystemAudio: false,
      countdownMs: 0,
      logKeys: true
    },
    captureBounds: { x: 0, y: 0, width: 1280, height: 720 },
    timing: {
      epoch: 1_000_000,
      startedAt: 1_000_000,
      endedAt: 1_008_000,
      pausedTotalMs: 0,
      clock: 'active'
    },
    mediaStartedAt: { screen: 1_000_250, webcam: 1_000_260, microphone: 1_000_300 },
    tracks: {
      screen: { fileName: 'screen.webm', bytes: 1, startedAt: 1_000_250 },
      webcam: { fileName: 'webcam.webm', bytes: 1, startedAt: 1_000_260 },
      microphone: { fileName: 'microphone.webm', bytes: 1, startedAt: 1_000_300 }
    },
    events: { fileName: 'events.jsonl', count: events.length },
    notes: []
  }
  writeFileSync(join(dir, 'project.json'), JSON.stringify(manifest, null, 2))
  return dir
}

if (process.argv[1] && process.argv[1].endsWith('make-fixture.mjs')) {
  const root = process.argv[2] ?? 'e2e/.fixtures'
  console.log(makeFixture(root))
}
