import { formatTimecode } from '@renderer/lib/format'
import { useEditor } from '@renderer/stores/editor'

const iconProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'currentColor',
  'aria-hidden': true
}

function PlayIcon(): React.JSX.Element {
  return (
    <svg {...iconProps}>
      <path d="M4 2.5v11a.5.5 0 0 0 .77.42l8.5-5.5a.5.5 0 0 0 0-.84l-8.5-5.5A.5.5 0 0 0 4 2.5Z" />
    </svg>
  )
}

function PauseIcon(): React.JSX.Element {
  return (
    <svg {...iconProps}>
      <rect x="3.5" y="2.5" width="3.2" height="11" rx="0.8" />
      <rect x="9.3" y="2.5" width="3.2" height="11" rx="0.8" />
    </svg>
  )
}

function SkipStartIcon(): React.JSX.Element {
  return (
    <svg {...iconProps}>
      <rect x="2.5" y="3" width="1.8" height="10" rx="0.5" />
      <path d="M13.5 3v10L6 8Z" />
    </svg>
  )
}

function SkipEndIcon(): React.JSX.Element {
  return (
    <svg {...iconProps}>
      <rect x="11.7" y="3" width="1.8" height="10" rx="0.5" />
      <path d="M2.5 3v10L10 8Z" />
    </svg>
  )
}

function StepIcon({ forward }: { forward: boolean }): React.JSX.Element {
  return (
    <svg {...iconProps}>
      {forward ? (
        <path d="M3 3.5v9L9.5 8ZM9 3.5v9L15.5 8Z" />
      ) : (
        <path d="M13 3.5v9L6.5 8ZM7 3.5v9L0.5 8Z" />
      )}
    </svg>
  )
}

const buttonClass =
  'flex size-8 items-center justify-center rounded-lg text-zinc-200 hover:bg-white/[0.08] disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400'

/** Icon transport with a timecode readout. Space and arrow keys are wired in the editor screen. */
export function Transport(): React.JSX.Element {
  const playing = useEditor((state) => state.playing)
  const playheadMs = useEditor((state) => state.playheadMs)
  const durationMs = useEditor((state) => state.media?.durationMs ?? 0)
  const togglePlay = useEditor((state) => state.togglePlay)
  const seek = useEditor((state) => state.seek)
  const skip = useEditor((state) => state.skip)
  const disabled = durationMs === 0

  return (
    <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
      <button
        type="button"
        aria-label="Go to start"
        title="Go to start (Home)"
        disabled={disabled}
        onClick={() => {
          void seek(0)
        }}
        className={buttonClass}
      >
        <SkipStartIcon />
      </button>
      <button
        type="button"
        aria-label="Back 5 seconds"
        title="Back 5 s (←)"
        disabled={disabled}
        onClick={() => {
          skip(-5000)
        }}
        className={buttonClass}
      >
        <StepIcon forward={false} />
      </button>
      <button
        type="button"
        aria-label={playing ? 'Pause' : 'Play'}
        title={playing ? 'Pause (Space)' : 'Play (Space)'}
        disabled={disabled}
        onClick={togglePlay}
        className="flex size-9 items-center justify-center rounded-lg bg-violet-500 text-white hover:bg-violet-400 disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      <button
        type="button"
        aria-label="Forward 5 seconds"
        title="Forward 5 s (→)"
        disabled={disabled}
        onClick={() => {
          skip(5000)
        }}
        className={buttonClass}
      >
        <StepIcon forward />
      </button>
      <button
        type="button"
        aria-label="Go to end"
        title="Go to end (End)"
        disabled={disabled}
        onClick={() => {
          void seek(durationMs)
        }}
        className={buttonClass}
      >
        <SkipEndIcon />
      </button>
      <span className="ml-3 font-mono text-sm tabular-nums text-zinc-100" aria-live="off">
        {formatTimecode(playheadMs)}
        <span className="text-zinc-500"> / {formatTimecode(durationMs)}</span>
      </span>
    </div>
  )
}
