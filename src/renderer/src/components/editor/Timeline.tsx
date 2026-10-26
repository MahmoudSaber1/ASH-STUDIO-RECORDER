import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { buildSegments } from '@shared/timeline'
import { useEditor } from '@renderer/stores/editor'
import { formatDuration } from '@renderer/lib/format'

const LABEL_WIDTH = 92
const ROW_HEIGHT = 34

/** Timeline in source time: clips, cuts, speed ramps, zoom segments, audio and the playhead. */
export function Timeline(): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  const waveformRef = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ startX: number; startMs: number; moved: boolean } | null>(null)
  const [dragSelection, setDragSelection] = useState<{ start: number; end: number } | null>(null)

  const media = useEditor((state) => state.media)
  const editor = useEditor((state) => state.editor)
  const playheadMs = useEditor((state) => state.playheadMs)
  const selection = useEditor((state) => state.selection)
  const selectedZoomId = useEditor((state) => state.selectedZoomId)
  const pxPerSecond = useEditor((state) => state.pxPerSecond)
  const waveform = useEditor((state) => state.waveform)
  const filmstrip = useEditor((state) => state.filmstrip)
  const seek = useEditor((state) => state.seek)
  const setSelection = useEditor((state) => state.setSelection)
  const setSelectedZoom = useEditor((state) => state.setSelectedZoom)
  const setPxPerSecond = useEditor((state) => state.setPxPerSecond)
  const removeRamp = useEditor((state) => state.removeRamp)

  const durationMs = media?.durationMs ?? 0
  const width = Math.max(1, (durationMs / 1000) * pxPerSecond)
  const segments = media ? buildSegments(durationMs, editor) : []
  const toX = (ms: number): number => (ms / 1000) * pxPerSecond
  const toMs = (x: number): number => Math.min(Math.max((x / pxPerSecond) * 1000, 0), durationMs)

  useEffect(() => {
    const canvas = waveformRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = Math.ceil(width)
    canvas.height = ROW_HEIGHT
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!waveform) return

    ctx.fillStyle = 'rgba(134, 239, 172, 0.6)'
    const mid = ROW_HEIGHT / 2
    const step = canvas.width / waveform.length
    for (let index = 0; index < waveform.length; index += 1) {
      const peak = waveform[index] ?? 0
      const bar = Math.max(1, peak * (ROW_HEIGHT - 6))
      ctx.fillRect(index * step, mid - bar / 2, Math.max(1, step), bar)
    }
  }, [waveform, width])

  const timeAtPointer = (event: ReactPointerEvent<HTMLDivElement>): number => {
    const rect = event.currentTarget.getBoundingClientRect()
    return toMs(event.clientX - rect.left - LABEL_WIDTH)
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!media || event.button !== 0) return
    const target = event.target as HTMLElement
    if (target.closest('[data-block]')) return

    event.currentTarget.setPointerCapture(event.pointerId)
    const ms = timeAtPointer(event)
    drag.current = { startX: event.clientX, startMs: ms, moved: false }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const current = drag.current
    if (!current) return
    if (Math.abs(event.clientX - current.startX) > 4) current.moved = true
    if (!current.moved) return

    const ms = timeAtPointer(event)
    const start = Math.min(current.startMs, ms)
    const end = Math.max(current.startMs, ms)
    setDragSelection({ start, end })
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const current = drag.current
    drag.current = null
    if (!current) return

    if (current.moved) {
      const ms = timeAtPointer(event)
      const start = Math.min(current.startMs, ms)
      const end = Math.max(current.startMs, ms)
      setDragSelection(null)
      if (end - start > 50) setSelection({ start, end })
      return
    }

    setDragSelection(null)
    setSelection(null)
    void seek(current.startMs)
  }

  const ticks: number[] = []
  const tickStep = pxPerSecond >= 120 ? 1 : pxPerSecond >= 40 ? 5 : 15
  for (let second = 0; second <= durationMs / 1000; second += tickStep) ticks.push(second)

  const activeSelection = dragSelection ?? selection

  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller) return
    const x = toX(playheadMs)
    const left = scroller.scrollLeft
    const visible = scroller.clientWidth - LABEL_WIDTH
    if (x < left || x > left + visible) scroller.scrollLeft = Math.max(0, x - visible / 2)
    // Only follow the playhead; pxPerSecond changes are handled by the zoom buttons.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playheadMs])

  if (!media) return <div className="h-40" />

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-white/8 bg-white/[0.02] p-3">
      <div className="flex items-center justify-between gap-3 text-[11px] text-zinc-500">
        <span className="font-mono tabular-nums text-zinc-300">
          {formatDuration(playheadMs)}{' '}
          <span className="text-zinc-600">/ {formatDuration(durationMs)}</span>
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Zoom timeline out"
            onClick={() => {
              setPxPerSecond(pxPerSecond / 1.5)
            }}
            className="size-6 rounded border border-white/10 text-zinc-300 hover:bg-white/[0.06]"
          >
            −
          </button>
          <button
            type="button"
            aria-label="Zoom timeline in"
            onClick={() => {
              setPxPerSecond(pxPerSecond * 1.5)
            }}
            className="size-6 rounded border border-white/10 text-zinc-300 hover:bg-white/[0.06]"
          >
            +
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="relative overflow-x-auto overflow-y-hidden rounded-lg bg-black/30 select-none"
      >
        <div
          role="slider"
          aria-label="Timeline"
          aria-valuemin={0}
          aria-valuemax={Math.round(durationMs)}
          aria-valuenow={Math.round(playheadMs)}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{ width: width + LABEL_WIDTH }}
          className="relative touch-none"
        >
          {/* Ruler */}
          <div className="relative h-6" style={{ paddingLeft: LABEL_WIDTH }}>
            {ticks.map((second) => (
              <span
                key={second}
                className="absolute top-1 text-[9px] text-zinc-500"
                style={{ left: LABEL_WIDTH + toX(second * 1000) + 2 }}
              >
                {formatDuration(second * 1000)}
              </span>
            ))}
          </div>

          <Row label="Clips">
            {filmstrip.map((frame, index) => {
              const next = filmstrip[index + 1]
              const span = next ? next.startMs - frame.startMs : durationMs - frame.startMs
              return (
                <img
                  key={frame.startMs}
                  src={frame.url}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  className="pointer-events-none absolute top-0.5 bottom-0.5 h-auto max-w-none object-cover opacity-80"
                  style={{
                    left: LABEL_WIDTH + toX(frame.startMs),
                    width: Math.max(1, toX(span)),
                    height: ROW_HEIGHT - 4
                  }}
                />
              )
            })}
            {segments.map((segment) => (
              <div
                key={`${segment.start}-${segment.end}`}
                className={`absolute top-1 bottom-1 rounded ${
                  segment.speed === 1 ? 'bg-violet-500/35' : 'bg-amber-400/40'
                }`}
                style={{
                  left: LABEL_WIDTH + toX(segment.start),
                  width: Math.max(2, toX(segment.end - segment.start))
                }}
              />
            ))}
            {editor.splits.map((split) => (
              <div
                key={`split-${split}`}
                className="absolute top-0 bottom-0 w-px bg-white/60"
                style={{ left: LABEL_WIDTH + toX(split) }}
              />
            ))}
            {editor.cuts.map((cut) => (
              <div
                key={`cut-${cut.start}`}
                className="absolute top-1 bottom-1 bg-rose-500/25 ring-1 ring-rose-400/40"
                style={{
                  left: LABEL_WIDTH + toX(cut.start),
                  width: Math.max(2, toX(cut.end - cut.start))
                }}
              />
            ))}
          </Row>

          <Row label="Speed">
            {editor.speedRamps.map((ramp) => (
              <button
                key={ramp.id}
                type="button"
                data-block
                onClick={() => {
                  removeRamp(ramp.id)
                }}
                title="Click to remove this speed change"
                className="absolute top-1 bottom-1 truncate rounded bg-amber-400/30 px-1 text-left text-[10px] text-amber-100 hover:bg-amber-400/50"
                style={{
                  left: LABEL_WIDTH + toX(ramp.start),
                  width: Math.max(16, toX(ramp.end - ramp.start))
                }}
              >
                {ramp.speed}×
              </button>
            ))}
          </Row>

          <Row label="Zoom">
            {editor.zoom.segments.map((segment) => (
              <button
                key={segment.id}
                type="button"
                data-block
                onClick={() => {
                  setSelectedZoom(segment.id)
                }}
                className={`absolute top-1 bottom-1 truncate rounded px-1 text-left text-[10px] ${
                  selectedZoomId === segment.id
                    ? 'bg-sky-400/60 text-white ring-1 ring-sky-200'
                    : segment.source === 'manual'
                      ? 'bg-sky-500/35 text-sky-100'
                      : 'bg-sky-500/20 text-sky-200'
                }`}
                style={{
                  left: LABEL_WIDTH + toX(segment.start),
                  width: Math.max(16, toX(segment.end - segment.start))
                }}
              >
                {segment.level.toFixed(1)}×
              </button>
            ))}
          </Row>

          <Row label="Audio">
            <canvas
              ref={waveformRef}
              className="absolute top-0 left-0"
              style={{ left: LABEL_WIDTH }}
            />
            {!waveform ? (
              <span
                className="absolute left-0 text-[10px] text-zinc-600"
                style={{ left: LABEL_WIDTH + 6 }}
              >
                {media.mic ? 'Loading waveform…' : 'No microphone track'}
              </span>
            ) : null}
          </Row>

          {activeSelection ? (
            <div
              className="pointer-events-none absolute top-6 bottom-0 bg-white/10 ring-1 ring-white/30"
              style={{
                left: LABEL_WIDTH + toX(activeSelection.start),
                width: Math.max(1, toX(activeSelection.end - activeSelection.start))
              }}
            />
          ) : null}

          <div
            className="pointer-events-none absolute top-0 bottom-0 w-px bg-white"
            style={{ left: LABEL_WIDTH + toX(playheadMs) }}
          >
            <div className="absolute -top-0 -left-1.5 size-3 rotate-45 rounded-sm bg-white" />
          </div>
        </div>
      </div>

      {selection ? (
        <p className="text-[11px] text-zinc-500">
          Selected {formatDuration(selection.start)} – {formatDuration(selection.end)}. Use the
          toolbar to delete, speed up, or trim it.
        </p>
      ) : (
        <p className="text-[11px] text-zinc-600">
          Click to move the playhead. Drag on empty space to select a range.
        </p>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="relative" style={{ height: ROW_HEIGHT }}>
      <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <div className="absolute inset-0">{children}</div>
    </div>
  )
}
