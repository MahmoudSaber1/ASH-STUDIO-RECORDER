import { useState, type ReactNode } from 'react'
import type { AspectPreset, EditorState, FaceCamAnchor, FaceCamShape } from '@shared/project'
import { useEditor } from '@renderer/stores/editor'
import { SpeedPanel } from './SpeedPanel'
import { BackgroundPanel } from './BackgroundPanel'

import {
  PRIMARY_INSPECTOR_TABS,
  MORE_INSPECTOR_TABS,
  type InspectorTab
} from './inspector-tabs'

function Section({ title, children }: { title: string; children: ReactNode }): React.JSX.Element {
  return (
    <section className="space-y-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        {title}
      </h3>
      {children}
    </section>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
  onCommit
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  format?: (value: number) => string
  onChange: (value: number) => void
  onCommit?: () => void
}): React.JSX.Element {
  return (
    <label className="block">
      <span className="flex justify-between text-xs text-zinc-400">
        {label}
        <span className="font-mono text-zinc-300">{format ? format(value) : value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => {
          onChange(Number(event.target.value))
        }}
        onPointerUp={onCommit}
        className="mt-1 w-full accent-brand-500"
      />
    </label>
  )
}

function Toggle({
  label,
  checked,
  onChange
}: {
  label: string
  checked: boolean
  onChange: (next: boolean) => void
}): React.JSX.Element {
  return (
    <label className="flex items-center justify-between gap-3 text-xs text-zinc-300">
      {label}
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => {
          onChange(event.target.checked)
        }}
        className="size-4 accent-brand-500"
      />
    </label>
  )
}

function Choice<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (next: T) => void
}): React.JSX.Element {
  return (
    <label className="block">
      <span className="text-xs text-zinc-400">{label}</span>
      <select
        value={value}
        onChange={(event) => {
          onChange(event.target.value as T)
        }}
        className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-zinc-200"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function Inspector({
  hasWebcam,
  hasMic,
  hasCursor
}: {
  hasWebcam: boolean
  hasMic: boolean
  hasCursor: boolean
}): React.JSX.Element {
  const [tab, setTab] = useState<InspectorTab>('zoom')
  const editor = useEditor((state) => state.editor)
  const update = useEditor((state) => state.update)
  const media = useEditor((state) => state.media)
  const selectedZoomId = useEditor((state) => state.selectedZoomId)
  const updateZoom = useEditor((state) => state.updateZoom)
  const removeZoom = useEditor((state) => state.removeZoom)
  const detectZoom = useEditor((state) => state.detectZoom)
  const addZoomAtPlayhead = useEditor((state) => state.addZoomAtPlayhead)

  const set = (next: (editor: EditorState) => EditorState, coalesce?: string): void => {
    update(next, coalesce)
  }

  const selectedZoom = editor.zoom.segments.find((segment) => segment.id === selectedZoomId) ?? null

  return (
    <aside className="flex h-full min-h-0 w-full flex-col bg-panel">
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-4">
        <h2 className="text-xs font-semibold text-zinc-100">Properties</h2>
        <span className="text-[11px] text-zinc-500">Inspector</span>
      </div>
      <div className="shrink-0 border-b border-white/10 px-3 py-3">
        <div role="group" aria-label="Primary inspector tools" className="grid grid-cols-4 gap-1">
          {PRIMARY_INSPECTOR_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={tab === item.id}
              onClick={() => {
                setTab(item.id)
              }}
              className={`rounded-lg px-1.5 py-2 text-[11px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400 ${
                tab === item.id
                  ? 'bg-brand-500/10 text-brand-300'
                  : 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="mt-2 block">
          <span className="sr-only">More inspector tools</span>
          <select
            aria-label="More inspector tools"
            value={MORE_INSPECTOR_TABS.some((item) => item.id === tab) ? tab : ''}
            onChange={(event) => {
              if (event.target.value) setTab(event.target.value as InspectorTab)
            }}
            className="w-full cursor-pointer rounded-md bg-transparent px-2 py-1.5 text-[11px] text-zinc-400 outline-none hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400"
          >
            <option value="">More tools</option>
            {MORE_INSPECTOR_TABS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
        {tab === 'zoom' ? (
          <>
            <Section title="Automatic">
              <Toggle
                label="Follow the cursor while zoomed"
                checked={editor.zoom.auto}
                onChange={(auto) => {
                  set((current) => ({ ...current, zoom: { ...current.zoom, auto } }))
                }}
              />
              <Slider
                label="Sensitivity"
                value={editor.zoom.sensitivity}
                min={0}
                max={1}
                step={0.05}
                format={(value) => `${Math.round(value * 100)}%`}
                onChange={(sensitivity) => {
                  set(
                    (current) => ({ ...current, zoom: { ...current.zoom, sensitivity } }),
                    'sensitivity'
                  )
                }}
              />
              <Slider
                label="Default zoom"
                value={editor.zoom.level}
                min={1.1}
                max={4}
                step={0.05}
                format={(value) => `${value.toFixed(2)}×`}
                onChange={(level) => {
                  set(
                    (current) => ({ ...current, zoom: { ...current.zoom, level } }),
                    'default-level'
                  )
                }}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!media?.samples.hasCursor}
                  onClick={detectZoom}
                  className="flex-1 rounded-lg bg-brand-500 px-3 py-2 text-xs font-medium text-white hover:bg-brand-400 disabled:opacity-40"
                >
                  Detect from clicks
                </button>
                <button
                  type="button"
                  onClick={addZoomAtPlayhead}
                  className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-200 hover:bg-white/[0.06]"
                >
                  Add at playhead
                </button>
              </div>
              {!hasCursor ? (
                <p className="text-[11px] text-zinc-500">
                  Cursor data is not available for window captures, so zoom follows fixed points.
                </p>
              ) : null}
            </Section>

            <Section title="Selected zoom">
              {selectedZoom ? (
                <>
                  <p className="text-[11px] text-zinc-500">
                    {selectedZoom.source === 'manual' ? 'Manual' : 'Automatic'} segment
                  </p>
                  <Slider
                    label="Zoom level"
                    value={selectedZoom.level}
                    min={1.1}
                    max={4}
                    step={0.05}
                    format={(value) => `${value.toFixed(2)}×`}
                    onChange={(level) => {
                      updateZoom(selectedZoom.id, { level })
                    }}
                  />
                  <Slider
                    label="Focus X"
                    value={selectedZoom.focusX}
                    min={0}
                    max={1}
                    step={0.01}
                    format={(value) => `${Math.round(value * 100)}%`}
                    onChange={(focusX) => {
                      updateZoom(selectedZoom.id, { focusX })
                    }}
                  />
                  <Slider
                    label="Focus Y"
                    value={selectedZoom.focusY}
                    min={0}
                    max={1}
                    step={0.01}
                    format={(value) => `${Math.round(value * 100)}%`}
                    onChange={(focusY) => {
                      updateZoom(selectedZoom.id, { focusY })
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      removeZoom(selectedZoom.id)
                    }}
                    className="rounded-lg border border-rose-400/30 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-400/10"
                  >
                    Remove segment
                  </button>
                </>
              ) : (
                <p className="text-xs text-zinc-500">
                  Select a zoom segment on the timeline to edit it.
                </p>
              )}
            </Section>
          </>
        ) : null}

        {tab === 'speed' ? <SpeedPanel /> : null}

        {tab === 'cursor' ? (
          <Section title="Cursor">
            <Toggle
              label="Show cursor"
              checked={editor.cursor.visible}
              onChange={(visible) => {
                set((current) => ({ ...current, cursor: { ...current.cursor, visible } }))
              }}
            />
            <Slider
              label="Size"
              value={editor.cursor.size}
              min={0.5}
              max={3}
              step={0.05}
              format={(value) => `${value.toFixed(2)}×`}
              onChange={(size) => {
                set(
                  (current) => ({ ...current, cursor: { ...current.cursor, size } }),
                  'cursor-size'
                )
              }}
            />
            <Slider
              label="Smoothing"
              value={editor.cursor.smoothing}
              min={0}
              max={1}
              step={0.05}
              onChange={(smoothing) => {
                set(
                  (current) => ({ ...current, cursor: { ...current.cursor, smoothing } }),
                  'cursor-smoothing'
                )
              }}
            />
            <Toggle
              label="Click ripples"
              checked={editor.cursor.clickRipples}
              onChange={(clickRipples) => {
                set((current) => ({ ...current, cursor: { ...current.cursor, clickRipples } }))
              }}
            />
            <Toggle
              label="Highlight cursor"
              checked={editor.cursor.highlight}
              onChange={(highlight) => {
                set((current) => ({ ...current, cursor: { ...current.cursor, highlight } }))
              }}
            />
            <Toggle
              label="Keystroke overlay"
              checked={editor.keystrokes}
              onChange={(keystrokes) => {
                set((current) => ({ ...current, keystrokes }))
              }}
            />
            {!hasCursor ? (
              <p className="text-[11px] text-zinc-500">
                Cursor overlays need display captures with known bounds.
              </p>
            ) : null}
          </Section>
        ) : null}

        {tab === 'background' ? <BackgroundPanel /> : null}

        {tab === 'frame' ? (
          <Section title="Frame">
            <Choice<AspectPreset>
              label="Aspect"
              value={editor.frame.aspect}
              options={[
                { value: 'original', label: 'Original' },
                { value: '16:9', label: '16:9' },
                { value: '9:16', label: '9:16 (vertical)' },
                { value: '1:1', label: '1:1' },
                { value: '4:3', label: '4:3' }
              ]}
              onChange={(aspect) => {
                set((current) => ({ ...current, frame: { ...current.frame, aspect } }))
              }}
            />
            <Slider
              label="Padding"
              value={editor.frame.padding}
              min={0}
              max={0.2}
              step={0.005}
              format={(value) => `${Math.round(value * 100)}%`}
              onChange={(padding) => {
                set((current) => ({ ...current, frame: { ...current.frame, padding } }), 'padding')
              }}
            />
            <Slider
              label="Corner radius"
              value={editor.frame.radius}
              min={0}
              max={0.1}
              step={0.002}
              format={(value) => `${Math.round(value * 1000) / 10}%`}
              onChange={(radius) => {
                set((current) => ({ ...current, frame: { ...current.frame, radius } }), 'radius')
              }}
            />
            <Slider
              label="Shadow"
              value={editor.frame.shadow}
              min={0}
              max={1}
              step={0.05}
              onChange={(shadow) => {
                set((current) => ({ ...current, frame: { ...current.frame, shadow } }), 'shadow')
              }}
            />
          </Section>
        ) : null}

        {tab === 'facecam' ? (
          <Section title="Face cam">
            {!hasWebcam ? (
              <p className="text-xs text-zinc-500">This recording has no camera track.</p>
            ) : (
              <>
                <Toggle
                  label="Show face cam"
                  checked={editor.faceCam.enabled}
                  onChange={(enabled) => {
                    set((current) => ({ ...current, faceCam: { ...current.faceCam, enabled } }))
                  }}
                />
                <Choice<FaceCamShape>
                  label="Shape"
                  value={editor.faceCam.shape}
                  options={[
                    { value: 'circle', label: 'Circle' },
                    { value: 'rounded', label: 'Rounded square' },
                    { value: 'rect', label: 'Rectangle' }
                  ]}
                  onChange={(shape) => {
                    set((current) => ({ ...current, faceCam: { ...current.faceCam, shape } }))
                  }}
                />
                <Choice<FaceCamAnchor>
                  label="Position"
                  value={editor.faceCam.anchor}
                  options={[
                    { value: 'bottom-right', label: 'Bottom right' },
                    { value: 'bottom-left', label: 'Bottom left' },
                    { value: 'top-right', label: 'Top right' },
                    { value: 'top-left', label: 'Top left' }
                  ]}
                  onChange={(anchor) => {
                    set((current) => ({ ...current, faceCam: { ...current.faceCam, anchor } }))
                  }}
                />
                <Slider
                  label="Size"
                  value={editor.faceCam.size}
                  min={0.08}
                  max={0.35}
                  step={0.01}
                  format={(value) => `${Math.round(value * 100)}%`}
                  onChange={(size) => {
                    set(
                      (current) => ({ ...current, faceCam: { ...current.faceCam, size } }),
                      'facecam-size'
                    )
                  }}
                />
                <Toggle
                  label="Mirror"
                  checked={editor.faceCam.mirror}
                  onChange={(mirror) => {
                    set((current) => ({ ...current, faceCam: { ...current.faceCam, mirror } }))
                  }}
                />
                <Toggle
                  label="White border"
                  checked={editor.faceCam.border}
                  onChange={(border) => {
                    set((current) => ({ ...current, faceCam: { ...current.faceCam, border } }))
                  }}
                />
                <Toggle
                  label="Hide while zoomed"
                  checked={editor.faceCam.hideDuringZoom}
                  onChange={(hideDuringZoom) => {
                    set((current) => ({
                      ...current,
                      faceCam: { ...current.faceCam, hideDuringZoom }
                    }))
                  }}
                />
              </>
            )}
          </Section>
        ) : null}

        {tab === 'audio' ? (
          <Section title="Audio">
            {!hasMic ? (
              <p className="text-xs text-zinc-500">This recording has no microphone track.</p>
            ) : (
              <>
                <Slider
                  label="Microphone volume"
                  value={editor.audio.micVolume}
                  min={0}
                  max={2}
                  step={0.05}
                  format={(value) => `${Math.round(value * 100)}%`}
                  onChange={(micVolume) => {
                    set(
                      (current) => ({ ...current, audio: { ...current.audio, micVolume } }),
                      'mic-volume'
                    )
                  }}
                />
                <Slider
                  label="Fade in"
                  value={editor.audio.fadeInMs}
                  min={0}
                  max={5000}
                  step={50}
                  format={(value) => `${(value / 1000).toFixed(1)} s`}
                  onChange={(fadeInMs) => {
                    set(
                      (current) => ({ ...current, audio: { ...current.audio, fadeInMs } }),
                      'fade-in'
                    )
                  }}
                />
                <Slider
                  label="Fade out"
                  value={editor.audio.fadeOutMs}
                  min={0}
                  max={5000}
                  step={50}
                  format={(value) => `${(value / 1000).toFixed(1)} s`}
                  onChange={(fadeOutMs) => {
                    set(
                      (current) => ({ ...current, audio: { ...current.audio, fadeOutMs } }),
                      'fade-out'
                    )
                  }}
                />
                <p className="text-[11px] text-zinc-500">
                  Audio is included in exports when the edit has no cuts or speed changes. Otherwise
                  the export is video only.
                </p>
              </>
            )}
          </Section>
        ) : null}
      </div>
    </aside>
  )
}
