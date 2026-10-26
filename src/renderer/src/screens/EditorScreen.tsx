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
      className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-medium text-zinc-300 hover:bg-white/[0.07] disabled:opacity-35"
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
  const split = useEditor((state) => state.split)
  const deleteSelection = useEditor((state) => state.deleteSelection)
  const restoreSelection = useEditor((state) => state.restoreSelection)
  const restoreAll = useEditor((state) => state.restoreAll)
  const trimToSelection = useEditor((state) => state.trimToSelection)
  const clearTrim = useEditor((state) => state.clearTrim)
  const editor = useEditor((state) => state.editor)
  const platform = usePlatformStore((state) => state.appInfo?.platform)
  const undo = useEditor((state) => state.undo)
  const redo = useEditor((state) => state.redo)
  const canUndo = useEditor((state) => state.past.length > 0)
  const canRedo = useEditor((state) => state.future.length > 0)
  const selection = useEditor((state) => state.selection)
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
      } else if (event.key.toLowerCase() === 's' && !mod) {
        split()
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        deleteSelection()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [togglePlay, split, deleteSelection, undo, redo, skip, seek])

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
    <div className="flex min-h-screen flex-1 flex-col">
      <header
        className={`sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-white/[0.04] bg-canvas/80 pr-5 backdrop-blur-xl [-webkit-app-region:drag] ${
          platform === 'darwin' ? 'pl-24' : 'pl-5'
        }`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => {
              go({ name: 'library' })
            }}
            className="rounded-lg px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200"
          >
            ← Projects
          </button>
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
                className="w-64 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm text-zinc-100 outline-none"
              />
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setRenaming(project.name)
              }}
              title="Rename"
              className="truncate text-sm font-semibold text-zinc-100 hover:text-white"
            >
              {project.name}
            </button>
          )}
          <span
            className={`text-[11px] ${saveStatus === 'error' ? 'text-rose-300' : 'text-zinc-500'}`}
          >
            {SAVE_LABEL[saveStatus]}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <ToolButton label="Undo" onClick={undo} disabled={!canUndo} title="Undo (⌘Z)" />
          <ToolButton label="Redo" onClick={redo} disabled={!canRedo} title="Redo (⇧⌘Z)" />
          <button
            type="button"
            onClick={() => {
              setExportOpen(true)
            }}
            className="rounded-lg bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-400"
          >
            Export
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-4 p-5 lg:flex-row">
        <section className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex min-h-[320px] flex-1">
            <Preview />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Transport />
            <span className="mx-1 h-6 w-px bg-white/10" aria-hidden="true" />
            <ToolButton label="Split" onClick={split} title="Split at playhead (S)" />
            <ToolButton
              label="Delete"
              onClick={deleteSelection}
              disabled={!selection}
              title="Remove selection (⌫)"
            />
            <ToolButton
              label="Restore"
              onClick={restoreSelection}
              disabled={!selection}
              title="Bring back removed time in selection"
            />
            <ToolButton
              label="Restore all"
              onClick={restoreAll}
              disabled={editor.cuts.length === 0}
            />
            <ToolButton label="Trim to selection" onClick={trimToSelection} disabled={!selection} />
            <ToolButton label="Clear trim" onClick={clearTrim} disabled={!editor.trim} />
            <span className="ml-auto text-[11px] text-zinc-500">
              Output {formatDuration(outputDuration)} · source {formatDuration(media.durationMs)}
            </span>
          </div>

          {notice ? (
            <p role="status" className="text-xs text-zinc-400">
              {notice}
            </p>
          ) : null}

          <Timeline />
        </section>

        <div className="w-full lg:w-80">
          <Inspector
            hasWebcam={media.webcam !== null}
            hasMic={media.mic !== null}
            hasCursor={hasCursor}
          />
        </div>
      </div>

      <ExportDialog />
    </div>
  )
}
