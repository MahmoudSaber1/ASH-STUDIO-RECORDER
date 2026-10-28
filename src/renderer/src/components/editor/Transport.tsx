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
  'flex size-8 items-center justify-center rounded-lg text-zinc-200 hover:bg-white/[0.08] disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400'

function SpeakerIcon({ muted }: { muted: boolean }): React.JSX.Element {
  return (
    <svg {...iconProps}>
      <path d="M2.5 6v4h2.6L8.5 13V3L5.1 6H2.5Z" />
      {muted ? (
        <path
          d="m10.5 6 3 3m0-3-3 3"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
        />
      ) : (
        <path
          d="M10.4 5.3a3.6 3.6 0 0 1 0 5.4M12.2 3.6a6 6 0 0 1 0 8.8"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          fill="none"
        />
      )}
    </svg>
  )
}

/**
 * Player controls: timecode, centered play controls and a preview volume.
 * Space plays, arrows step 5 s (1 s with Shift), Home and End jump.
 */
export function Transport(): React.JSX.Element {
  const playing = useEditor((state) => state.playing)
  const playheadMs = useEditor((state) => state.playheadMs)
  const durationMs = useEditor((state) => state.media?.durationMs ?? 0)
  const hasAudio = useEditor((state) => state.media?.mic != null)
  const volume = useEditor((state) => state.previewVolume)
  const muted = useEditor((state) => state.previewMuted)
  const togglePlay = useEditor((state) => state.togglePlay)
  const seek = useEditor((state) => state.seek)
  const skip = useEditor((state) => state.skip)
  const setVolume = useEditor((state) => state.setPreviewVolume)
  const toggleMuted = useEditor((state) => state.togglePreviewMuted)
  const disabled = durationMs === 0
  const shownVolume = muted ? 0 : volume

  return (
    <div className="flex max-w-full flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.8)]">
      <span className="font-mono text-xs tabular-nums text-zinc-100 sm:text-sm" aria-live="off">
        {formatTimecode(playheadMs)}
        <span className="text-zinc-500"> / {formatTimecode(durationMs)}</span>
      </span>

      <div className="flex items-center gap-1">
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
          className="mx-1 flex size-11 items-center justify-center rounded-full bg-brand-500 text-white shadow-[0_6px_20px_-6px_rgba(166,234,0,0.8)] hover:bg-brand-400 disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
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
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={muted ? 'Unmute preview' : 'Mute preview'}
          title={hasAudio ? 'Preview volume' : 'This recording has no audio'}
          disabled={!hasAudio}
          onClick={toggleMuted}
          className={buttonClass}
        >
          <SpeakerIcon muted={muted || volume === 0} />
        </button>
        <input
          type="range"
          aria-label="Preview volume"
          min={0}
          max={1}
          step={0.05}
          value={shownVolume}
          disabled={!hasAudio}
          onChange={(event) => {
            setVolume(Number(event.target.value))
          }}
          className="w-20 accent-brand-500 disabled:opacity-35"
        />
      </div>
    </div>
  )
}
