import { useEffect, useRef, useState } from 'react'
import type { CaptureSource, CaptureTarget, PermissionKind, RecorderTrack } from '@shared/ipc'
import { AppHeader } from '@renderer/components/AppHeader'
import { NavTabs } from '@renderer/components/NavTabs'
import { useNavigation } from '@renderer/stores/navigation'
import { formatDuration } from '@renderer/lib/format'
import { describeCaptureError, openSourcePreview } from '@renderer/lib/capture'
import { usePlatformStore } from '@renderer/stores/platform'
import { useRecorderStore } from '@renderer/stores/recorder'

interface RecorderScreenProps {
  onOpenSetup: () => void
}

const TRACK_LABELS: Record<RecorderTrack, string> = {
  screen: 'Screen',
  webcam: 'Camera',
  microphone: 'Microphone',
  systemAudio: 'System audio'
}

const SHORTCUT_HINT = '⌘⇧R to start · ⌘⇧P to pause · ⌘⇧S to stop'

function ToggleRow({
  title,
  description,
  checked,
  disabled = false,
  onChange
}: {
  title: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
}): React.JSX.Element {
  return (
    <div className={`flex items-start justify-between gap-3 ${disabled ? 'opacity-50' : ''}`}>
      <div className="min-w-0">
        <p className="text-xs font-medium text-zinc-200">{title}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 box-border h-5 w-9 shrink-0 overflow-hidden rounded-full border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 ${
          checked ? 'border-brand-400/40 bg-brand-500' : 'border-white/10 bg-white/[0.06]'
        } disabled:cursor-not-allowed`}
      >
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 2,
            left: 2,
            width: 14,
            height: 14,
            borderRadius: 9999,
            background: '#fff',
            boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
            transform: checked ? 'translateX(16px)' : 'translateX(0)',
            transition: 'transform 150ms ease'
          }}
        />
      </button>
    </div>
  )
}

function SourcePreview({ target }: { target: CaptureTarget }): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<'loading' | 'live' | 'error'>('loading')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const video = videoRef.current
    let cancelled = false
    let stream: MediaStream | null = null

    openSourcePreview(target)
      .then((next) => {
        if (cancelled) {
          next.getTracks().forEach((track) => track.stop())
          return
        }
        stream = next
        if (video) {
          video.srcObject = next
          void video.play().catch(() => undefined)
        }
        setStatus('live')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setMessage(describeCaptureError(error))
        setStatus('error')
      })

    return () => {
      cancelled = true
      stream?.getTracks().forEach((track) => track.stop())
      if (video) video.srcObject = null
    }
  }, [target])

  return (
    <div className="w-full">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        Live preview {status === 'live' ? '· live' : ''}
      </p>
      <div className="relative mx-auto flex aspect-video w-full max-w-[900px] items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#000]">
        <video
          ref={videoRef}
          muted
          playsInline
          aria-label={`Live preview of ${target.name}`}
          className="size-full object-contain"
        />
        {status !== 'live' ? (
          <p className="absolute px-6 text-center text-xs text-zinc-400">
            {status === 'loading'
              ? 'Connecting to the source…'
              : (message ?? 'Preview unavailable')}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function Segmented({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: number
  options: Array<{ value: number; label: string }>
  onChange: (value: number) => void
}): React.JSX.Element {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <div className="mt-1.5 flex rounded-lg border border-white/10 bg-black/20 p-0.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400 ${
              value === option.value
                ? 'bg-white/[0.09] text-white'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function SourceCard({
  source,
  selected,
  onSelect
}: {
  source: CaptureSource
  selected: boolean
  onSelect: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group min-w-0 overflow-hidden rounded-xl border text-left transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 ${
        selected
          ? 'border-brand-400/60 bg-brand-400/10 shadow-[0_0_0_1px_rgba(166,234,0,0.35)]'
          : 'border-white/8 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]'
      }`}
    >
      <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-[#000]">
        {source.thumbnail ? (
          <img
            src={source.thumbnail}
            alt=""
            className={`size-full object-contain transition-transform duration-300 ${
              selected ? 'scale-[1.02]' : 'group-hover:scale-[1.02]'
            }`}
          />
        ) : (
          <div className="flex size-full items-center justify-center text-[10px] text-zinc-600">
            No preview
          </div>
        )}
        {source.appIcon ? (
          <img
            src={source.appIcon}
            alt=""
            className="absolute bottom-2 left-2 size-5 rounded bg-black/50 p-0.5"
          />
        ) : null}
        {selected ? (
          <span className="absolute right-2 top-2 rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-semibold text-white">
            Selected
          </span>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <span className="truncate text-xs text-zinc-300">{source.name}</span>
        <span className="shrink-0 rounded border border-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-zinc-500">
          {source.kind === 'window'
            ? 'Window'
            : (source.aspectRatio ?? 1) < 1
              ? 'Portrait'
              : 'Display'}
        </span>
      </div>
    </button>
  )
}

export function RecorderScreen({ onOpenSetup }: RecorderScreenProps): React.JSX.Element {
  const phase = useRecorderStore((state) => state.phase)
  const localPhase = useRecorderStore((state) => state.localPhase)
  const countdown = useRecorderStore((state) => state.countdown)
  const target = useRecorderStore((state) => state.target)
  const sources = useRecorderStore((state) => state.sources)
  const sourcesStatus = useRecorderStore((state) => state.sourcesStatus)
  const sourcesError = useRecorderStore((state) => state.sourcesError)
  const options = useRecorderStore((state) => state.options)
  const error = useRecorderStore((state) => state.error)
  const warnings = useRecorderStore((state) => state.warnings)
  const elapsedMs = useRecorderStore((state) => state.elapsedMs)
  const activeTracks = useRecorderStore((state) => state.activeTracks)
  const inputTracking = useRecorderStore((state) => state.inputTracking)
  const projectDir = useRecorderStore((state) => state.projectDir)
  const loadSources = useRecorderStore((state) => state.loadSources)
  const selectTarget = useRecorderStore((state) => state.selectTarget)
  const updateOptions = useRecorderStore((state) => state.updateOptions)
  const start = useRecorderStore((state) => state.start)
  const cancelStart = useRecorderStore((state) => state.cancelStart)
  const pause = useRecorderStore((state) => state.pause)
  const resume = useRecorderStore((state) => state.resume)
  const stop = useRecorderStore((state) => state.stop)
  const reset = useRecorderStore((state) => state.reset)
  const openProjectFolder = useRecorderStore((state) => state.openProjectFolder)
  const goTo = useNavigation((state) => state.go)
  const projectKey = projectDir ? (projectDir.split(/[\\/]/).pop() ?? null) : null

  const permissions = usePlatformStore((state) => state.permissions)
  const capabilities = usePlatformStore((state) => state.capabilities)

  const [kind, setKind] = useState<'screen' | 'window'>('screen')
  const [deviceNotice, setDeviceNotice] = useState<{
    kind: PermissionKind
    message: string
  } | null>(null)
  const requestPermission = usePlatformStore((state) => state.requestPermission)

  /**
   * Turning a device on asks the OS for access first. Without this step the
   * toggle could be on while the capture quietly fails.
   */
  const setDevice = async (device: 'camera' | 'microphone', on: boolean): Promise<void> => {
    setDeviceNotice(null)
    const enable = (value: boolean): void => {
      if (device === 'camera') updateOptions({ captureWebcam: value })
      else updateOptions({ captureMicrophone: value })
    }

    if (!on) {
      enable(false)
      return
    }

    await requestPermission(device)
    const status = usePlatformStore
      .getState()
      .permissions.find((item) => item.kind === device)?.status

    if (status === 'granted' || status === 'unknown') {
      enable(true)
      return
    }

    enable(false)
    setDeviceNotice({
      kind: device,
      message:
        status === 'not-determined'
          ? 'macOS did not show the permission prompt. Open system settings, allow the app, then try again.'
          : `${device === 'camera' ? 'Camera' : 'Microphone'} access is off, so the track was not turned on.`
    })
  }

  const screenReady = permissions.some(
    (permission) => permission.kind === 'screen' && permission.status === 'granted'
  )
  const screenCount = sources.filter((source) => source.kind === 'screen').length
  const windowCount = sources.filter((source) => source.kind === 'window').length
  const visibleSources = sources.filter((source) => source.kind === kind)
  const isBusy = phase === 'recording' || phase === 'paused' || phase === 'stopping'
  const isFinished = phase === 'completed' || phase === 'error'
  const startDisabled = !screenReady || !target || isBusy || localPhase !== 'idle'

  useEffect(() => {
    void loadSources()
  }, [loadSources])

  const changeKind = (next: 'screen' | 'window'): void => {
    setKind(next)
    if (target?.kind !== next) {
      const first = sources.find((source) => source.kind === next)
      if (first) selectTarget(first)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-1 flex-col overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(166,234,0,0.14),transparent_55%)]"
      />

      <AppHeader>
        <NavTabs />
        <button
          type="button"
          onClick={onOpenSetup}
          className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
        >
          System check
        </button>
      </AppHeader>

      <main className="relative z-10 mx-auto w-full max-w-[1600px] flex-1 px-4 pb-10 pt-5 md:px-6">
        {warnings.length > 0 ? (
          <div className="mx-auto mb-5 max-w-xl space-y-2" role="status">
            {warnings.map((warning) => (
              <p
                key={warning}
                className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-xs leading-relaxed text-amber-100"
              >
                {warning}
              </p>
            ))}
          </div>
        ) : null}

        {isBusy || isFinished ? (
          <section className="mx-auto mt-10 w-full max-w-xl">
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-8 text-center shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]">
              <div className="flex items-center justify-center gap-2">
                <span
                  className={`size-2 rounded-full ${
                    phase === 'recording'
                      ? 'animate-pulse bg-rose-400'
                      : phase === 'paused'
                        ? 'bg-amber-400'
                        : phase === 'completed'
                          ? 'bg-emerald-400'
                          : 'bg-zinc-500'
                  }`}
                />
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                  {phase === 'recording'
                    ? 'Recording'
                    : phase === 'paused'
                      ? 'Paused'
                      : phase === 'stopping'
                        ? 'Finishing'
                        : phase === 'completed'
                          ? 'Saved'
                          : 'Recorder'}
                </span>
              </div>

              <p className="mt-4 font-mono text-6xl font-light tabular-nums tracking-tight text-white">
                {formatDuration(elapsedMs)}
              </p>

              <p className="mt-2 truncate text-xs text-zinc-400">
                {target
                  ? `${target.kind === 'screen' ? 'Display' : 'Window'} · ${target.name}`
                  : '—'}
              </p>

              {phase === 'completed' ? (
                <>
                  <p className="mt-5 text-xs text-zinc-500">
                    Screen, camera, microphone, and input events are saved as raw files. Effects
                    stay editable.
                  </p>
                  <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                    {projectKey ? (
                      <button
                        type="button"
                        onClick={() => {
                          goTo({ name: 'editor', key: projectKey })
                        }}
                        className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
                      >
                        Open in editor
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        void openProjectFolder()
                      }}
                      className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
                    >
                      Show in folder
                    </button>
                    <button
                      type="button"
                      onClick={reset}
                      className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
                    >
                      New recording
                    </button>
                  </div>
                </>
              ) : (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                  {phase === 'recording' || phase === 'paused' ? (
                    <button
                      type="button"
                      onClick={() => {
                        void (phase === 'paused' ? resume() : pause())
                      }}
                      className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
                    >
                      {phase === 'paused' ? 'Resume' : 'Pause'}
                    </button>
                  ) : null}

                  {phase === 'recording' || phase === 'paused' ? (
                    <button
                      type="button"
                      onClick={() => {
                        void stop()
                      }}
                      className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400"
                    >
                      Stop recording
                    </button>
                  ) : null}

                  {phase === 'stopping' ? (
                    <span className="text-xs text-zinc-500">Flushing the last chunks…</span>
                  ) : null}
                </div>
              )}

              {phase !== 'completed' ? (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-1.5">
                  {activeTracks.map((track) => (
                    <span
                      key={track}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-zinc-400"
                    >
                      {TRACK_LABELS[track]}
                    </span>
                  ))}
                </div>
              ) : null}

              {phase === 'recording' ? (
                <p className="mt-5 text-[11px] text-zinc-500">
                  {inputTracking === 'active'
                    ? 'Cursor and input tracking active'
                    : inputTracking === 'unavailable'
                      ? 'Input tracking unavailable — check Accessibility access'
                      : 'Input tracking paused'}
                </p>
              ) : null}

              {projectDir ? (
                <p className="mt-4 truncate font-mono text-[10px] text-zinc-600" title={projectDir}>
                  {projectDir}
                </p>
              ) : null}
            </div>
          </section>
        ) : (
          <>
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-white">
                  Choose what to record.
                </h1>
                <p className="mt-1 text-xs text-zinc-500">
                  Choose a display or window. Polish your capture later in the editor.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  void loadSources(true)
                }}
                disabled={sourcesStatus === 'loading'}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/[0.06] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
              >
                {sourcesStatus === 'loading' ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>

            {!screenReady ? (
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3">
                <p className="text-xs text-amber-100">
                  Screen Recording permission is required to list displays and windows.
                </p>
                <button
                  type="button"
                  onClick={onOpenSetup}
                  className="rounded-lg bg-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-950 transition-colors hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
                >
                  Open system check
                </button>
              </div>
            ) : null}

            {error || sourcesError ? (
              <div
                role="alert"
                className="mb-5 rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-xs text-rose-200"
              >
                {sourcesError ?? error}
              </div>
            ) : null}

            <div className="grid min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-panel/60 lg:min-h-[580px] lg:grid-cols-[210px_minmax(0,1fr)_280px] xl:grid-cols-[240px_minmax(0,1fr)_300px]">
              <section
                aria-label="Capture sources"
                className="min-w-0 border-b border-white/10 p-4 lg:max-h-[min(740px,calc(100dvh-180px))] lg:overflow-y-auto lg:border-r lg:border-b-0"
              >
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h2 className="text-xs font-semibold text-zinc-100">Capture sources</h2>
                  <span className="text-[10px] text-zinc-500">{screenCount + windowCount} available</span>
                </div>
                <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg border border-white/10 bg-black/20 p-1">
                  <button
                    type="button"
                    onClick={() => changeKind('screen')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      kind === 'screen'
                        ? 'bg-white/[0.08] text-white'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Displays <span className="ml-1 text-zinc-500">{screenCount}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => changeKind('window')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      kind === 'window'
                        ? 'bg-white/[0.08] text-white'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Windows <span className="ml-1 text-zinc-500">{windowCount}</span>
                  </button>
                </div>

                {sourcesStatus === 'loading' && visibleSources.length === 0 ? (
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
                    {[0, 1, 2, 3].map((item) => (
                      <div
                        key={item}
                        className="aspect-[16/10] animate-pulse rounded-xl border border-white/5 bg-white/[0.02]"
                      />
                    ))}
                  </div>
                ) : visibleSources.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/10 px-6 py-12 text-center">
                    <p className="text-sm text-zinc-400">
                      {kind === 'window' ? 'No windows detected.' : 'No displays detected.'}
                    </p>
                    <p className="mt-1 text-xs text-zinc-600">
                      Open the app you want to record, then refresh.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
                    {visibleSources.map((source) => (
                      <SourceCard
                        key={source.id}
                        source={source}
                        selected={target?.id === source.id}
                        onSelect={() => selectTarget(source)}
                      />
                    ))}
                  </div>
                )}

              </section>

              <section
                aria-label="Recording preview"
                className="flex min-h-[380px] min-w-0 flex-col gap-3 bg-canvas p-4 md:p-5 lg:min-h-0"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-300/70">
                      Capture studio
                    </p>
                    <h2 className="mt-1 text-lg font-semibold tracking-tight text-zinc-100">
                      Ready for your next take.
                    </h2>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] ${
                      screenReady && target
                        ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                        : 'border-white/10 bg-white/[0.03] text-zinc-500'
                    }`}
                  >
                    {screenReady && target ? 'Source connected' : 'Select a source'}
                  </span>
                </div>
                <div className="flex min-h-[240px] flex-1 items-center justify-center">
                  {target && screenReady ? (
                    <SourcePreview key={target.id} target={target} />
                  ) : (
                    <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center">
                      <p className="max-w-xs text-sm text-zinc-500">
                        {screenReady
                          ? 'Choose a display or window from Capture sources to see a live preview.'
                          : 'Allow screen recording in System check to preview a source.'}
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-zinc-400">
                  <span className="min-w-0 truncate">
                    {target ? `${target.kind === 'screen' ? 'Display' : 'Window'} · ${target.name}` : 'No source selected'}
                  </span>
                  <span className="shrink-0 text-zinc-500">Saved locally · No uploads</span>
                </div>
              </section>

              <aside
                aria-label="Capture settings"
                className="min-w-0 border-t border-white/10 bg-panel lg:border-t-0 lg:border-l"
              >
                <div className="h-full bg-panel p-4 lg:p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Capture settings
                  </p>

                  <div className="mt-4 space-y-4">
                    <Segmented
                      label="Frame rate"
                      value={options.fps}
                      options={[
                        { value: 30, label: '30 fps' },
                        { value: 60, label: '60 fps' }
                      ]}
                      onChange={(fps) => updateOptions({ fps: fps === 60 ? 60 : 30 })}
                    />

                    <Segmented
                      label="Countdown"
                      value={options.countdownMs}
                      options={[
                        { value: 0, label: 'Off' },
                        { value: 3000, label: '3 s' },
                        { value: 5000, label: '5 s' }
                      ]}
                      onChange={(countdownMs) => updateOptions({ countdownMs })}
                    />

                    <div className="h-px bg-white/5" />

                    <ToggleRow
                      title="Camera"
                      description="Record a separate webcam track you can place later."
                      checked={options.captureWebcam}
                      onChange={(on) => {
                        void setDevice('camera', on)
                      }}
                    />

                    <ToggleRow
                      title="Microphone"
                      description="Record narration on its own audio track."
                      checked={options.captureMicrophone}
                      onChange={(on) => {
                        void setDevice('microphone', on)
                      }}
                    />
                    {deviceNotice ? (
                      <div
                        role="alert"
                        className="rounded-lg border border-amber-400/25 bg-amber-400/10 p-3 text-[11px] leading-relaxed text-amber-100"
                      >
                        <p>{deviceNotice.message}</p>
                        <button
                          type="button"
                          onClick={() => {
                            void window.api.platform.openPermissionSettings(deviceNotice.kind)
                          }}
                          className="mt-2 rounded-md border border-amber-300/40 px-2 py-1 text-[11px] font-medium text-amber-100 hover:bg-amber-300/10"
                        >
                          Open system settings
                        </button>
                      </div>
                    ) : null}

                    <ToggleRow
                      title="System audio"
                      description={
                        capabilities?.supportsSystemAudioCapture
                          ? 'Capture app and desktop sound.'
                          : 'Only available on Windows.'
                      }
                      checked={options.captureSystemAudio}
                      disabled={!capabilities?.supportsSystemAudioCapture}
                      onChange={(captureSystemAudio) => updateOptions({ captureSystemAudio })}
                    />

                    <ToggleRow
                      title="Log keystrokes"
                      description="Key codes only, used for optional keyboard overlays."
                      checked={options.logKeys}
                      onChange={(logKeys) => updateOptions({ logKeys })}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      void start()
                    }}
                    disabled={startDisabled}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
                  >
                    <span className="size-2 rounded-full bg-[#000]" />
                    Start recording
                  </button>

                  <p className="mt-2.5 text-center text-[10px] leading-relaxed text-zinc-600">
                    {!target
                      ? 'Select a display or window first.'
                      : 'The window minimizes after the countdown. Use the floating bar to pause or stop.'}
                  </p>

                  <p className="mt-3 text-center text-[10px] text-zinc-600">{SHORTCUT_HINT}</p>
                </div>

              </aside>
            </div>
          </>
        )}
      </main>

      {localPhase !== 'idle' ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Starting recording"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-black/75 backdrop-blur-md"
        >
          {localPhase === 'countdown' ? (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-400">
                Recording starts in
              </p>
              <p className="font-mono text-8xl font-light tabular-nums text-white">{countdown}</p>
            </>
          ) : (
            <>
              <span className="size-6 animate-spin rounded-full border-2 border-white/20 border-t-brand-400" />
              <p className="text-xs text-zinc-400">
                {localPhase === 'acquiring' ? 'Preparing capture…' : 'Starting…'}
              </p>
            </>
          )}

          <button
            type="button"
            onClick={cancelStart}
            className="mt-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
          >
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  )
}
