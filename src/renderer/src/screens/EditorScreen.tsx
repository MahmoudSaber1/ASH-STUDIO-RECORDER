import { useEffect, useState } from 'react'
import { Inspector } from '@renderer/components/editor/Inspector'
import { ExportDialog } from '@renderer/components/editor/ExportDialog'
import { Preview } from '@renderer/components/editor/Preview'
import { Timeline } from '@renderer/components/editor/Timeline'
import { formatDuration } from '@renderer/lib/format'
import { useEditor, selectOutputDuration } from '@renderer/stores/editor'
import { useNavigation } from '@renderer/stores/navigation'
import { usePlatformStore } from '@renderer/stores/platform'
import { Transport } from '@renderer/components/editor/Transport'

const SAVE_LABEL = {
  saved: 'Saved',
  pending: 'Unsaved changes',
  saving: 'Saving…',
  error: 'Could not save'
} as const

function ToolButton({
  label,
  onClick,
  disabled = false,
  title
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  title?: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      title={title ?? label}
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-medium text-zinc-300 hover:bg-white/[0.07] disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400"
    >
      {label}
    </button>
  )
}

export function EditorScreen({ projectKey }: { projectKey: string }): React.JSX.Element {
  const load = useEditor((state) => state.load)
  const close = useEditor((state) => state.close)
  const status = useEditor((state) => state.status)
  const error = useEditor((state) => state.error)
  const project = useEditor((state) => state.project)
  const media = useEditor((state) => state.media)
  const hasCursor = useEditor((state) => state.media?.samples.hasCursor ?? false)
  const saveStatus = useEditor((state) => state.saveStatus)
  const notice = useEditor((state) => state.notice)
  const clearNotice = useEditor((state) => state.clearNotice)
  const togglePlay = useEditor((state) => state.togglePlay)
  const skip = useEditor((state) => state.skip)
  const seek = useEditor((state) => state.seek)
  const platform = usePlatformStore((state) => state.appInfo?.platform)
  const undo = useEditor((state) => state.undo)
  const redo = useEditor((state) => state.redo)
  const canUndo = useEditor((state) => state.past.length > 0)
  const canRedo = useEditor((state) => state.future.length > 0)
  const setExportOpen = useEditor((state) => state.setExportOpen)
  const renameProject = useEditor((state) => state.renameProject)
  const outputDuration = useEditor(selectOutputDuration)
  const go = useNavigation((state) => state.go)
  const [renaming, setRenaming] = useState<string | null>(null)

  useEffect(() => {
    void load(projectKey)
    return () => {
      close()
    }
  }, [projectKey, load, close])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(clearNotice, 4000)
    return () => {
      clearTimeout(timer)
    }
  }, [notice, clearNotice])

  // Keyboard shortcuts. Ignored while typing in a field.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return

      const mod = event.metaKey || event.ctrlKey
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
        return
      }
      if (event.key === ' ') {
        event.preventDefault()
        togglePlay()
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        skip(-(event.shiftKey ? 1000 : 5000))
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        skip(event.shiftKey ? 1000 : 5000)
      } else if (event.key === 'Home') {
        event.preventDefault()
        void seek(0)
      } else if (event.key === 'End') {
        event.preventDefault()
        void seek(useEditor.getState().media?.durationMs ?? 0)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [togglePlay, undo, redo, skip, seek])

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="flex min-h-screen items-center justify-center text-xs text-zinc-500">
        Opening project…
      </div>
    )
  }

  if (status === 'error' || !project || !media) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6">
        <p role="alert" className="max-w-md text-center text-sm text-rose-200">
          {error ?? 'This project could not be opened.'}
        </p>
        <button
          type="button"
          onClick={() => {
            go({ name: 'library' })
          }}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.06]"
        >
          Back to projects
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-canvas text-zinc-100">
      <header
        className={`sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-panel/95 pr-4 backdrop-blur-xl [-webkit-app-region:drag] ${
          platform === 'darwin' ? 'pl-24' : 'pl-4'
        }`}
      >
        <div className="flex min-w-0 items-center gap-3 [-webkit-app-region:no-drag]">
          <button
            type="button"
            onClick={() => {
              go({ name: 'library' })
            }}
            className="shrink-0 rounded-md px-2 py-1.5 text-xs text-zinc-400 hover:bg-white/[0.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400"
          >
            ← Projects
          </button>
          <div className="min-w-0 border-l border-white/10 pl-3">
            {renaming !== null ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  void renameProject(renaming).then(() => {
                    setRenaming(null)
                  })
                }}
              >
                <input
                  aria-label="Project name"
                  autoFocus
                  value={renaming}
                  onChange={(event) => {
                    setRenaming(event.target.value)
                  }}
                  onBlur={() => {
                    setRenaming(null)
                  }}
                  className="w-52 max-w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm text-zinc-100 outline-none focus-visible:border-brand-400"
                />
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setRenaming(project.name)
                }}
                title="Rename"
                className="block max-w-full truncate text-left text-sm font-semibold text-zinc-100 hover:text-white"
              >
                {project.name}
              </button>
            )}
            <span
              role="status"
              className={`block truncate text-[10px] ${
                saveStatus === 'error'
                  ? 'text-rose-300'
                  : saveStatus === 'saved'
                    ? 'text-emerald-300/80'
                    : 'text-zinc-500'
              }`}
            >
              {SAVE_LABEL[saveStatus]}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 [-webkit-app-region:no-drag]">
          <ToolButton label="Undo" onClick={undo} disabled={!canUndo} title="Undo (⌘Z)" />
          <ToolButton label="Redo" onClick={redo} disabled={!canRedo} title="Redo (⇧⌘Z)" />
          <button
            type="button"
            onClick={() => {
              setExportOpen(true)
            }}
            className="rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-zinc-950 hover:bg-brand-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
          >
            Export
          </button>
        </div>
      </header>

      <main className="grid min-w-0 flex-1 grid-cols-1 lg:h-[calc(100dvh-3.5rem)] lg:min-h-[620px] lg:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-label="Video editor workspace" className="flex min-h-[640px] min-w-0 flex-col lg:min-h-0">
          <div className="flex min-h-[350px] min-w-0 flex-1 flex-col bg-canvas">
            <div className="px-5 pt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200/50">
              Live output preview
            </div>
            <div className="flex min-h-[230px] min-w-0 flex-1 overflow-hidden px-4 pt-2 md:px-6">
              <Preview />
            </div>
            <div className="flex shrink-0 items-center justify-center px-3 py-3">
              <Transport />
            </div>
            <div className="shrink-0 pb-3 text-center text-[11px] text-zinc-500">
              Output {formatDuration(outputDuration)} · source {formatDuration(media.durationMs)}
            </div>
          </div>

          {notice ? (
            <p role="status" className="border-t border-white/5 px-5 py-2 text-xs text-zinc-300">
              {notice}
            </p>
          ) : null}

          <section aria-label="Timeline workspace" className="min-w-0 shrink-0 border-t border-white/10 bg-panel px-3 py-3 md:px-5">
            <div className="mb-2 flex items-center gap-3">
              <h2 className="text-xs font-semibold text-zinc-100">Timeline</h2>
              <span className="text-[11px] text-zinc-500">Clips · Speed · Zoom · Audio</span>
            </div>
            <Timeline />
          </section>
        </section>

        <div className="min-h-[400px] min-w-0 border-t border-white/10 bg-panel lg:min-h-0 lg:border-t-0 lg:border-l">
          <Inspector
            hasWebcam={media.webcam !== null}
            hasMic={media.mic !== null}
            hasCursor={hasCursor}
          />
        </div>
      </main>

      <ExportDialog />
    </div>
  )
}
