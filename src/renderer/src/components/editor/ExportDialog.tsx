import { useRef, useState } from 'react'
import type { ExportFormat } from '@shared/export'
import type { ResolutionPreset } from '@shared/output'
import { runExport, type ExportOptions } from '@renderer/lib/exporter'
import { useEditor } from '@renderer/stores/editor'

const RESOLUTIONS: ResolutionPreset[] = ['720p', '1080p', '1440p', '4K']

const isHardwareCapable = (): boolean =>
  typeof navigator !== 'undefined' && /Mac|Windows/.test(navigator.userAgent)

type Phase = 'idle' | 'running' | 'done' | 'error'

export function ExportDialog(): React.JSX.Element | null {
  const open = useEditor((state) => state.exportOpen)
  const setOpen = useEditor((state) => state.setExportOpen)
  const project = useEditor((state) => state.project)
  const media = useEditor((state) => state.media)
  const editor = useEditor((state) => state.editor)
  const key = useEditor((state) => state.key)

  const [format, setFormat] = useState<ExportFormat>('mp4')
  const [resolution, setResolution] = useState<ResolutionPreset>('1080p')
  const [fps, setFps] = useState<30 | 60>(30)
  const [hardware, setHardware] = useState(false)
  const [includeAudio, setIncludeAudio] = useState(true)
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  if (!open || !project || !media || !key) return null

  const start = async (): Promise<void> => {
    const controller = new AbortController()
    abortRef.current = controller
    setPhase('running')
    setProgress(0)
    setError(null)
    setResult(null)

    const options: ExportOptions = { format, resolution, fps, hardware, includeAudio }

    try {
      const path = await runExport({
        key,
        project,
        media,
        editor,
        options,
        signal: controller.signal,
        onProgress: ({ frame, total }) => {
          setProgress(frame / total)
        }
      })
      if (path === null) {
        setPhase('idle')
        return
      }
      setResult(path)
      setPhase('done')
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') {
        setPhase('idle')
        return
      }
      setError(caught instanceof Error ? caught.message : 'Export failed')
      setPhase('error')
    } finally {
      abortRef.current = null
    }
  }

  const close = (): void => {
    abortRef.current?.abort()
    setOpen(false)
    setPhase('idle')
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Export video"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-panel p-6 shadow-2xl">
        <h2 className="text-base font-semibold text-white">Export video</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Renders your edit frame by frame with the same engine as the preview.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-4 text-xs text-zinc-300">
          <label>
            Format
            <select
              value={format}
              disabled={phase === 'running'}
              onChange={(event) => {
                setFormat(event.target.value as ExportFormat)
              }}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5"
            >
              <option value="mp4">MP4 (H.264)</option>
              <option value="webm">WebM (VP9)</option>
              <option value="gif">GIF</option>
            </select>
          </label>
          <label>
            Resolution
            <select
              value={resolution}
              disabled={phase === 'running'}
              onChange={(event) => {
                setResolution(event.target.value as ResolutionPreset)
              }}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5"
            >
              {RESOLUTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            Frame rate
            <select
              value={fps}
              disabled={phase === 'running' || format === 'gif'}
              onChange={(event) => {
                setFps(Number(event.target.value) === 60 ? 60 : 30)
              }}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5"
            >
              <option value={30}>30 fps</option>
              <option value={60}>60 fps</option>
            </select>
          </label>
          <label className="flex items-end gap-2 pb-1.5">
            <input
              type="checkbox"
              checked={includeAudio}
              disabled={phase === 'running' || !media.mic || format === 'gif'}
              onChange={(event) => {
                setIncludeAudio(event.target.checked)
              }}
              className="accent-violet-500"
            />
            Include microphone
          </label>
          {isHardwareCapable() && format !== 'webm' && format !== 'gif' ? (
            <label className="col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={hardware}
                disabled={phase === 'running'}
                onChange={(event) => {
                  setHardware(event.target.checked)
                }}
                className="accent-violet-500"
              />
              Use the hardware encoder (faster, larger files)
            </label>
          ) : null}
        </div>

        {phase === 'running' ? (
          <div className="mt-5">
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-violet-500 transition-[width]"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-zinc-500">
              Rendering… {Math.round(progress * 100)}%
            </p>
          </div>
        ) : null}

        {phase === 'done' && result ? (
          <p className="mt-5 break-all rounded-lg bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200">
            Saved to {result}
          </p>
        ) : null}
        {phase === 'error' && error ? (
          <p
            role="alert"
            className="mt-5 whitespace-pre-wrap rounded-lg bg-rose-400/10 px-3 py-2 text-xs text-rose-200"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            className="rounded-lg px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200"
          >
            {phase === 'running' ? 'Cancel export' : 'Close'}
          </button>
          {phase !== 'running' ? (
            <button
              type="button"
              onClick={() => {
                void start()
              }}
              className="rounded-lg bg-violet-500 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-400"
            >
              {phase === 'done' ? 'Export again' : 'Export'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
