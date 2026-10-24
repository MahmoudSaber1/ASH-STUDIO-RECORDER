import { useState } from 'react'
import { formatDuration } from '@renderer/lib/format'
import { useRecorderStore } from '@renderer/stores/recorder'

const dragStyle = { WebkitAppRegion: 'drag' } as React.CSSProperties
const noDragStyle = { WebkitAppRegion: 'no-drag' } as React.CSSProperties

function PauseIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5" fill="currentColor">
      <rect x="3" y="2.5" width="3.5" height="11" rx="1" />
      <rect x="9.5" y="2.5" width="3.5" height="11" rx="1" />
    </svg>
  )
}

function PlayIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5" fill="currentColor">
      <path d="M4 2.8c0-.8.9-1.3 1.6-.9l8 5.2c.6.4.6 1.4 0 1.8l-8 5.2c-.7.4-1.6-.1-1.6-.9V2.8Z" />
    </svg>
  )
}

function StopIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5" fill="currentColor">
      <rect x="3" y="3" width="10" height="10" rx="2" />
    </svg>
  )
}

export function RecorderToolbar(): React.JSX.Element {
  const phase = useRecorderStore((state) => state.phase)
  const elapsedMs = useRecorderStore((state) => state.elapsedMs)
  const [pending, setPending] = useState(false)

  const active = phase === 'recording' || phase === 'paused' || phase === 'stopping'

  const togglePause = async (): Promise<void> => {
    if (pending || phase === 'stopping') return
    setPending(true)
    try {
      if (phase === 'paused') {
        await window.api.recorder.resume()
      } else {
        await window.api.recorder.pause()
      }
    } catch (error) {
      console.error('[toolbar] failed to toggle pause', error)
    } finally {
      setPending(false)
    }
  }

  const stop = async (): Promise<void> => {
    if (pending || phase === 'stopping') return
    setPending(true)
    try {
      await window.api.recorder.stop()
    } catch (error) {
      console.error('[toolbar] failed to stop recording', error)
    } finally {
      setPending(false)
    }
  }

  if (!active) {
    return <div className="size-full" />
  }

  return (
    <div className="flex size-full items-stretch p-1.5">
      <div
        style={dragStyle}
        className="flex h-full w-full items-center gap-2.5 rounded-2xl border border-white/10 bg-[#111116]/95 px-3 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.85)] backdrop-blur-xl"
      >
        <span
          className={`size-2 shrink-0 rounded-full ${
            phase === 'recording'
              ? 'animate-pulse bg-rose-400'
              : phase === 'paused'
                ? 'bg-amber-400'
                : 'bg-zinc-500'
          }`}
        />

        <div className="min-w-0 flex-1">
          <p className="font-mono text-[15px] font-medium leading-none tabular-nums text-white">
            {formatDuration(elapsedMs)}
          </p>
          <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            {phase === 'recording' ? 'Recording' : phase === 'paused' ? 'Paused' : 'Saving'}
          </p>
        </div>

        <button
          type="button"
          style={noDragStyle}
          onClick={() => {
            void togglePause()
          }}
          disabled={pending || phase === 'stopping'}
          aria-label={phase === 'paused' ? 'Resume recording' : 'Pause recording'}
          title={phase === 'paused' ? 'Resume (⌘⇧P)' : 'Pause (⌘⇧P)'}
          className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-zinc-200 transition-colors hover:bg-white/[0.1] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
        >
          {phase === 'paused' ? <PlayIcon /> : <PauseIcon />}
        </button>

        <button
          type="button"
          style={noDragStyle}
          onClick={() => {
            void stop()
          }}
          disabled={pending || phase === 'stopping'}
          aria-label="Stop recording"
          title="Stop (⌘⇧S)"
          className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-rose-500 text-white transition-colors hover:bg-rose-400 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400"
        >
          <StopIcon />
        </button>
      </div>
    </div>
  )
}
