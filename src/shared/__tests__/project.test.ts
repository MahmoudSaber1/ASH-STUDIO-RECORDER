import { describe, expect, it } from 'vitest'
import { normalizeEditor, parseProject, PROJECT_SCHEMA_VERSION } from '../project'

let counter = 0
const newId = (): string => `id-${(counter += 1)}`

const v1Manifest = {
  schemaVersion: 1,
  id: '2026-01-01 10-00-00 Screen',
  app: { name: 'Ash Studio Recorder', version: '0.1.0' },
  status: 'completed',
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:01:00.000Z',
  target: { id: 'screen:1', name: 'Display 1', kind: 'screen' },
  options: {
    fps: 30,
    captureWebcam: false,
    captureMicrophone: false,
    captureSystemAudio: false,
    countdownMs: 0,
    logKeys: false
  },
  timing: { epoch: 1_000, startedAt: 1_000, endedAt: 61_000, pausedTotalMs: 0, clock: 'active' },
  mediaStartedAt: { screen: 1_250 },
  tracks: { screen: { fileName: 'screen.webm', bytes: 10, startedAt: 1_250 } },
  events: { fileName: 'events.jsonl', count: 3 },
  notes: []
}

describe('parseProject', () => {
  it('migrates a v1 manifest to the current schema', () => {
    const project = parseProject(v1Manifest, newId)
    expect(project.schemaVersion).toBe(PROJECT_SCHEMA_VERSION)
    expect(project.name).toBe('Display 1')
    expect(project.id).toBe('2026-01-01 10-00-00 Screen')
    expect(project.editor.zoom.auto).toBe(true)
    expect(project.tracks.screen?.fileName).toBe('screen.webm')
  })

  it('keeps an existing id and name', () => {
    const project = parseProject(
      { ...v1Manifest, schemaVersion: 2, id: 'abc', name: 'Demo' },
      newId
    )
    expect(project.id).toBe('abc')
    expect(project.name).toBe('Demo')
  })

  it('refuses projects from a newer schema', () => {
    expect(() => parseProject({ ...v1Manifest, schemaVersion: 99 }, newId)).toThrow(/newer version/)
  })

  it('rejects files without a capture target', () => {
    expect(() => parseProject({ schemaVersion: 2 }, newId)).toThrow(/capture target/)
  })
})

describe('normalizeEditor', () => {
  it('returns defaults for garbage input', () => {
    expect(normalizeEditor('nope').frame.aspect).toBe('original')
  })

  it('clamps numbers and drops invalid ranges', () => {
    const editor = normalizeEditor({
      zoom: { level: 10, sensitivity: -1 },
      trim: { start: 500, end: 100 },
      frame: { aspect: '21:9', padding: 5 },
      background: { kind: 'solid', color: 'red' }
    })
    expect(editor.zoom.level).toBe(4)
    expect(editor.zoom.sensitivity).toBe(0)
    expect(editor.trim).toBeNull()
    expect(editor.frame.aspect).toBe('original')
    expect(editor.frame.padding).toBe(0.2)
    expect(editor.background).toEqual({ kind: 'solid', color: '#1b1b2f' })
  })
})
