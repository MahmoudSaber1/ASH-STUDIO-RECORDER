import { useCallback, useEffect, useState } from 'react'
import type { ProjectSummary } from '@shared/project'
import { AppHeader } from '@renderer/components/AppHeader'
import { NavTabs } from '@renderer/components/NavTabs'
import { generateThumbnail } from '@renderer/lib/thumbnail'
import { useNavigation } from '@renderer/stores/navigation'

const formatDuration = (ms: number): string => {
  const total = Math.round(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

const formatDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'

const STATUS_LABEL: Record<NonNullable<ProjectSummary['status']>, string> = {
  recording: 'Recording',
  completed: 'Ready',
  incomplete: 'Partial',
  error: 'Error'
}

interface CardProps {
  project: ProjectSummary
  thumbnail: string | null
  onChanged: () => void
}

function ProjectCard({ project, thumbnail, onChanged }: CardProps): React.JSX.Element {
  const go = useNavigation((state) => state.go)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(project.name)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const run = async (action: () => Promise<unknown>): Promise<void> => {
    setBusy(true)
    setMessage(null)
    try {
      await action()
      onChanged()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const broken = project.error !== null

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-white/[0.025]">
      <div className="relative aspect-video w-full bg-black/50">
        {thumbnail ? (
          <img src={thumbnail} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-[11px] text-zinc-600">
            {broken ? 'Unreadable project' : 'No preview yet'}
          </div>
        )}
        {project.status ? (
          <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-300">
            {STATUS_LABEL[project.status]}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        {renaming ? (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void run(async () => {
                await window.api.projects.rename(project.key, name)
                setRenaming(false)
              })
            }}
            className="flex gap-2"
          >
            <input
              aria-label="Project name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-zinc-100 outline-none focus-visible:border-brand-400"
            />
            <button
              type="submit"
              className="rounded-lg bg-brand-500 px-3 text-xs font-medium text-white"
            >
              Save
            </button>
          </form>
        ) : (
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-zinc-100" title={project.name}>
              {project.name}
            </h3>
            <p className="mt-1 text-[11px] text-zinc-500">
              {broken
                ? project.error
                : `${formatDuration(project.durationMs)} · ${formatDate(project.updatedAt)}`}
            </p>
          </div>
        )}

        {message ? <p className="text-[11px] text-rose-300">{message}</p> : null}

        <div className="mt-auto flex flex-wrap gap-1.5">
          {!broken ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                go({ name: 'editor', key: project.key })
              }}
              className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-400 disabled:opacity-50"
            >
              Open
            </button>
          ) : null}
          {!broken ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setName(project.name)
                setRenaming(true)
              }}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.06] disabled:opacity-50"
            >
              Rename
            </button>
          ) : null}
          {!broken ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void run(() => window.api.projects.duplicate(project.key))
              }}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.06] disabled:opacity-50"
            >
              Duplicate
            </button>
          ) : null}
          {!broken ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void run(() => window.api.projects.export(project.key))
              }}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.06] disabled:opacity-50"
            >
              Export folder
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void window.api.projects.reveal(project.key)
            }}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.06] disabled:opacity-50"
          >
            Show in folder
          </button>
          {confirming ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  void run(() => window.api.projects.remove(project.key))
                }}
                className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-400 disabled:opacity-50"
              >
                Move to Trash
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false)
                }}
                className="rounded-lg px-2 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setConfirming(true)
              }}
              className="rounded-lg px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-400/10 disabled:opacity-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

export function LibraryScreen(): React.JSX.Element {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null)
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      setProjects(await window.api.projects.list())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load projects')
    }
  }, [])

  useEffect(() => {
    let active = true
    window.api.projects
      .list()
      .then((list) => {
        if (active) setProjects(list)
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : 'Could not load projects')
      })
    return () => {
      active = false
    }
  }, [])

  // Fill in missing thumbnails one at a time, so the app stays responsive.
  useEffect(() => {
    if (!projects) return
    let cancelled = false

    const run = async (): Promise<void> => {
      for (const project of projects) {
        if (cancelled || project.error || !project.status) continue

        const existing = await window.api.projects.getThumbnail(project.key)
        if (existing) {
          if (!cancelled) setThumbnails((current) => ({ ...current, [project.key]: existing }))
          continue
        }

        const screenFile = await window.api.projects
          .get(project.key)
          .then((full) => full.tracks.screen?.fileName ?? null)
          .catch(() => null)
        if (!screenFile || cancelled) continue

        await generateThumbnail(project.key, screenFile).catch(() => undefined)
        const generated = await window.api.projects.getThumbnail(project.key)
        if (generated && !cancelled) {
          setThumbnails((current) => ({ ...current, [project.key]: generated }))
        }
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [projects])

  const importProject = async (): Promise<void> => {
    try {
      const key = await window.api.projects.import()
      if (key) await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Import failed')
    }
  }

  return (
    <div className="relative flex min-h-screen flex-1 flex-col">
      <AppHeader>
        <NavTabs />
      </AppHeader>

      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-6 pb-12 pt-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Projects</h1>
            <p className="mt-1 text-xs text-zinc-500">
              Every recording is a folder on this machine. Open one to edit it.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                void importProject()
              }}
              className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/[0.06]"
            >
              Import folder
            </button>
            <button
              type="button"
              onClick={() => {
                void refresh()
              }}
              className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/[0.06]"
            >
              Refresh
            </button>
          </div>
        </div>

        {error ? (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-xs text-rose-200"
          >
            {error}
          </div>
        ) : null}

        {projects === null ? (
          <p className="text-xs text-zinc-500">Loading projects…</p>
        ) : projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 px-6 py-16 text-center">
            <p className="text-sm text-zinc-400">No projects yet.</p>
            <p className="mt-1 text-xs text-zinc-600">
              Record something, and it will show up here.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.key}
                project={project}
                thumbnail={thumbnails[project.key] ?? null}
                onChanged={() => {
                  void refresh()
                }}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
