import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  assertValidKey,
  duplicateProject,
  exportProject,
  importProject,
  listProjects,
  readProject,
  renameProject,
  resolveMediaPath,
  saveEditor
} from '../store'

const v1Manifest = (name: string) => ({
  schemaVersion: 1,
  id: name,
  app: { name: 'Ash Studio Recorder', version: '0.1.0' },
  status: 'completed',
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:01:00.000Z',
  target: { id: 'screen:1', name, kind: 'screen' },
  options: {
    fps: 30,
    captureWebcam: false,
    captureMicrophone: false,
    captureSystemAudio: false,
    countdownMs: 0,
    logKeys: false
  },
  timing: { epoch: 1000, startedAt: 1000, endedAt: 61_000, pausedTotalMs: 0, clock: 'active' },
  mediaStartedAt: { screen: 1250 },
  tracks: { screen: { fileName: 'screen.webm', bytes: 4, startedAt: 1250 } },
  events: { fileName: 'events.jsonl', count: 0 },
  notes: []
})

let root: string

const makeProject = async (key: string, manifest = v1Manifest(key)): Promise<void> => {
  const dir = join(root, key)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'project.json'), JSON.stringify(manifest))
  await writeFile(join(dir, 'screen.webm'), 'data')
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'ash-projects-'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('project store', () => {
  it('lists projects and migrates them to the current schema', async () => {
    await makeProject('Demo')
    const [summary] = await listProjects(root)
    expect(summary).toMatchObject({ key: 'Demo', name: 'Demo', status: 'completed', error: null })
    expect(summary?.id).toBeTruthy()
  })

  it('reports unreadable projects without hiding the rest', async () => {
    await makeProject('Good')
    await mkdir(join(root, 'Broken'))
    await writeFile(join(root, 'Broken', 'project.json'), '{not json')

    const summaries = await listProjects(root)
    expect(summaries.map((item) => item.key).sort()).toEqual(['Broken', 'Good'])
    expect(summaries.find((item) => item.key === 'Broken')?.error).toBeTruthy()
  })

  it('renames a project and rejects empty names', async () => {
    await makeProject('Demo')
    await renameProject(root, 'Demo', '  Launch video  ')
    expect((await readProject(root, 'Demo')).name).toBe('Launch video')
    await expect(renameProject(root, 'Demo', '   ')).rejects.toThrow(/cannot be empty/)
  })

  it('duplicates a project with a new id and copies its media', async () => {
    await makeProject('Demo')
    const copy = await duplicateProject(root, 'Demo')
    const original = await readProject(root, 'Demo')
    const duplicate = await readProject(root, copy)
    expect(copy).toBe('Demo copy')
    expect(duplicate.id).not.toBe(original.id)
    expect(duplicate.name).toBe('Demo copy')
    expect(await readFile(join(root, copy, 'screen.webm'), 'utf8')).toBe('data')
  })

  it('saves normalized editor state', async () => {
    await makeProject('Demo')
    const saved = await saveEditor(root, 'Demo', { zoom: { level: 99 } })
    expect(saved.zoom.level).toBe(4)
    expect((await readProject(root, 'Demo')).editor.zoom.level).toBe(4)
  })

  it('imports a project folder under a fresh id', async () => {
    await makeProject('External')
    const source = join(root, 'External')
    const target = join(root, 'library')
    const key = await importProject(target, source)
    expect(key).toBe('External')
    const imported = await readProject(target, key)
    expect(imported.id).not.toBe((await readProject(root, 'External')).id)
  })

  it('exports a project folder to another location', async () => {
    await makeProject('Shared')
    const destination = join(root, 'out')
    const path = await exportProject(root, 'Shared', destination)
    expect(path).toBe(join(destination, 'Shared'))
    expect(await readFile(join(path, 'screen.webm'), 'utf8')).toBe('data')
  })

  it('only resolves media files that the project lists', async () => {
    await makeProject('Demo')
    expect(await resolveMediaPath(root, 'Demo', 'screen.webm')).toBe(
      join(root, 'Demo', 'screen.webm')
    )
    expect(await resolveMediaPath(root, 'Demo', '../secret.txt')).toBeNull()
    expect(await resolveMediaPath(root, 'Demo', 'other.webm')).toBeNull()
  })

  it('rejects keys that could escape the root', () => {
    expect(() => assertValidKey('../etc')).toThrow(/Invalid project key/)
    expect(() => assertValidKey('a/b')).toThrow(/Invalid project key/)
    expect(() => assertValidKey('')).toThrow(/Invalid project key/)
  })
})
