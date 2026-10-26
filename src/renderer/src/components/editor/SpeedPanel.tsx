import { useState } from 'react'
import { buildSegments, outputDurationMs } from '@shared/timeline'
import { formatTimecode } from '@renderer/lib/format'
import { useEditor } from '@renderer/stores/editor'

const PRESETS = [0.5, 1, 2, 4, 8]

const SPEED_MIN = 0.25
const SPEED_MAX = 8

function Heading({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
      {children}
    </h3>
  )
}

/**
 * Speed controls for the editor: presets and a custom value for the selected range,
 * idle detection with its own threshold, and a list of every speed change.
 */
export function SpeedPanel(): React.JSX.Element {
  const selection = useEditor((state) => state.selection)
  const editor = useEditor((state) => state.editor)
  const media = useEditor((state) => state.media)
  const speedSelection = useEditor((state) => state.speedSelection)
  const setRampSpeed = useEditor((state) => state.setRampSpeed)
  const removeRamp = useEditor((state) => state.removeRamp)
  const clearSpeedChanges = useEditor((state) => state.clearSpeedChanges)
  const speedUpIdle = useEditor((state) => state.speedUpIdle)

  const [custom, setCustom] = useState('1.5')
  const [idleSeconds, setIdleSeconds] = useState(2)
  const [idleSpeed, setIdleSpeed] = useState(4)

  const durationMs = media?.durationMs ?? 0
  const outputMs = outputDurationMs(buildSegments(durationMs, editor))
  const customValue = Number(custom)
  const customValid =
    Number.isFinite(customValue) && customValue >= SPEED_MIN && customValue <= SPEED_MAX

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <Heading>Selected range</Heading>
        {selection ? (
          <p className="font-mono text-[11px] text-zinc-400">
            {formatTimecode(selection.start)} → {formatTimecode(selection.end)}
            <span className="text-zinc-600">
              {' '}
              · {((selection.end - selection.start) / 1000).toFixed(2)} s
            </span>
          </p>
        ) : (
          <p className="text-xs text-zinc-500">
            Drag on the timeline to select a range, then choose a speed.
          </p>
        )}

        <div className="grid grid-cols-5 gap-1">
          {PRESETS.map((speed) => (
            <button
              key={speed}
              type="button"
              disabled={!selection}
              onClick={() => {
                speedSelection(speed)
              }}
              className="rounded-lg border border-white/10 py-1.5 text-xs text-zinc-200 hover:bg-white/[0.07] disabled:opacity-35"
            >
              {speed}×
            </button>
          ))}
        </div>

        <div className="flex items-end gap-2">
          <label className="flex-1 text-xs text-zinc-400">
            Custom speed ({SPEED_MIN}–{SPEED_MAX}×)
            <input
              type="number"
              inputMode="decimal"
              step={0.05}
              min={SPEED_MIN}
              max={SPEED_MAX}
              value={custom}
              onChange={(event) => {
                setCustom(event.target.value)
              }}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-xs text-zinc-100"
            />
          </label>
          <button
            type="button"
            disabled={!selection || !customValid}
            onClick={() => {
              speedSelection(customValue)
            }}
            className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-400 disabled:opacity-35"
          >
            Apply
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <Heading>Idle time</Heading>
        <p className="text-[11px] leading-relaxed text-zinc-500">
          Finds stretches with no mouse or keyboard input for at least the threshold, then changes
          their speed.
        </p>
        <label className="block text-xs text-zinc-400">
          Minimum idle: <span className="font-mono text-zinc-200">{idleSeconds.toFixed(1)} s</span>
          <input
            type="range"
            min={1}
            max={10}
            step={0.5}
            value={idleSeconds}
            onChange={(event) => {
              setIdleSeconds(Number(event.target.value))
            }}
            className="mt-1 w-full accent-brand-500"
          />
        </label>
        <label className="block text-xs text-zinc-400">
          Idle speed: <span className="font-mono text-zinc-200">{idleSpeed}×</span>
          <input
            type="range"
            min={1}
            max={8}
            step={0.5}
            value={idleSpeed}
            onChange={(event) => {
              setIdleSpeed(Number(event.target.value))
            }}
            className="mt-1 w-full accent-brand-500"
          />
        </label>
        <button
          type="button"
          onClick={() => {
            speedUpIdle(idleSeconds * 1000, idleSpeed)
          }}
          className="w-full rounded-lg border border-white/10 py-2 text-xs text-zinc-200 hover:bg-white/[0.07]"
        >
          Apply to idle time
        </button>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <Heading>Speed changes</Heading>
          <button
            type="button"
            disabled={editor.speedRamps.length === 0}
            onClick={clearSpeedChanges}
            className="text-[11px] text-rose-300 hover:text-rose-200 disabled:opacity-35"
          >
            Clear all
          </button>
        </div>

        {editor.speedRamps.length === 0 ? (
          <p className="text-xs text-zinc-500">Everything plays at 1×.</p>
        ) : (
          <ul className="space-y-2">
            {[...editor.speedRamps]
              .sort((a, b) => a.start - b.start)
              .map((ramp) => (
                <li
                  key={ramp.id}
                  className="flex items-center gap-2 rounded-lg border border-white/8 bg-black/20 p-2"
                >
                  <span className="min-w-0 flex-1 font-mono text-[11px] text-zinc-400">
                    {formatTimecode(ramp.start)} → {formatTimecode(ramp.end)}
                  </span>
                  <select
                    aria-label="Speed for this range"
                    value={ramp.speed}
                    onChange={(event) => {
                      setRampSpeed(ramp.id, Number(event.target.value))
                    }}
                    className="rounded-md border border-white/10 bg-black/40 px-1.5 py-1 text-xs text-zinc-200"
                  >
                    {[0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8].map((value) => (
                      <option key={value} value={value}>
                        {value}×
                      </option>
                    ))}
                    {PRESETS.includes(ramp.speed) ||
                    [0.25, 1.5, 3, 6].includes(ramp.speed) ? null : (
                      <option value={ramp.speed}>{ramp.speed}×</option>
                    )}
                  </select>
                  <button
                    type="button"
                    aria-label="Remove speed change"
                    onClick={() => {
                      removeRamp(ramp.id)
                    }}
                    className="rounded-md px-1.5 py-1 text-xs text-zinc-400 hover:text-rose-300"
                  >
                    ✕
                  </button>
                </li>
              ))}
          </ul>
        )}

        <p className="font-mono text-[11px] text-zinc-500">
          Output length {formatTimecode(outputMs)} · source {formatTimecode(durationMs)}
        </p>
      </section>
    </div>
  )
}
