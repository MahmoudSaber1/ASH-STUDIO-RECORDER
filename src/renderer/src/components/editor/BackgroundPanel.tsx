import { useMemo, useState } from 'react'
import { WALLPAPER_IDS, type Background, type EditorState } from '@shared/project'
import { mediaUrl } from '@shared/media'
import { WALLPAPER_LABELS, wallpaperCanvas } from '@renderer/lib/backgrounds'
import { useEditor } from '@renderer/stores/editor'

type Kind = Background['kind']

const KINDS: Array<{ id: Kind; label: string }> = [
  { id: 'wallpaper', label: 'Wallpaper' },
  { id: 'gradient', label: 'Gradient' },
  { id: 'solid', label: 'Color' },
  { id: 'image', label: 'Image' }
]

const GRADIENTS: Array<{ from: string; to: string; angle: number }> = [
  { from: '#a6ea00', to: '#75e900', angle: 180 },
  { from: '#0a0a0a', to: '#1f1f1f', angle: 180 },
  { from: '#0f172a', to: '#0ea5e9', angle: 120 },
  { from: '#f97316', to: '#db2777', angle: 135 },
  { from: '#22c55e', to: '#0ea5e9', angle: 160 },
  { from: '#e2e8f0', to: '#94a3b8', angle: 180 }
]

const COLORS = [
  '#0b0b0f',
  '#1b1b2f',
  '#ffffff',
  '#f1f5f9',
  '#7c3aed',
  '#0ea5e9',
  '#16a34a',
  '#f97316'
]

const Heading = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
  <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
    {children}
  </h3>
)

const swatchClass = (selected: boolean): string =>
  `overflow-hidden rounded-lg border transition-colors ${
    selected ? 'border-brand-400 ring-2 ring-brand-400/40' : 'border-white/10 hover:border-white/30'
  }`

/** Background choices: original wallpapers, gradients, solid colors and the user's own images. */
export function BackgroundPanel(): React.JSX.Element {
  const editor = useEditor((state) => state.editor)
  const update = useEditor((state) => state.update)
  const projectKey = useEditor((state) => state.key)
  const background = editor.background
  const [error, setError] = useState<string | null>(null)

  const setBackground = (next: Background, coalesce?: string): void => {
    update((current: EditorState) => ({ ...current, background: next }), coalesce)
  }

  // Small previews are painted once, from the same code that paints the frame.
  const swatches = useMemo(
    () =>
      Object.fromEntries(
        WALLPAPER_IDS.map((id) => [
          id,
          wallpaperCanvas(id, 160, 90)?.toDataURL('image/jpeg', 0.8) ?? ''
        ])
      ),
    []
  )

  const chooseKind = (kind: Kind): void => {
    if (kind === background.kind) return
    if (kind === 'wallpaper') setBackground({ kind: 'wallpaper', id: 'dunes' })
    else if (kind === 'gradient') setBackground({ kind: 'gradient', ...GRADIENTS[0]! })
    else if (kind === 'solid') setBackground({ kind: 'solid', color: '#1b1b2f' })
    else void chooseImage()
  }

  const chooseImage = async (): Promise<void> => {
    if (!projectKey) return
    setError(null)
    try {
      const fileName = await window.api.projects.importBackground(projectKey)
      if (fileName) setBackground({ kind: 'image', fileName, blur: 0 })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not use this image')
    }
  }

  return (
    <div className="space-y-5">
      <div
        role="radiogroup"
        aria-label="Background type"
        className="grid grid-cols-4 gap-1 rounded-lg border border-white/10 bg-black/20 p-0.5"
      >
        {KINDS.map((kind) => (
          <button
            key={kind.id}
            type="button"
            role="radio"
            aria-checked={background.kind === kind.id}
            onClick={() => {
              chooseKind(kind.id)
            }}
            className={`rounded-md py-1.5 text-[11px] font-medium ${
              background.kind === kind.id
                ? 'bg-white/[0.1] text-white'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {kind.label}
          </button>
        ))}
      </div>

      {background.kind === 'wallpaper' ? (
        <section className="space-y-3">
          <Heading>Wallpapers</Heading>
          <div className="grid grid-cols-2 gap-2">
            {WALLPAPER_IDS.map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={background.id === id}
                onClick={() => {
                  setBackground({ kind: 'wallpaper', id })
                }}
                className={swatchClass(background.id === id)}
              >
                <img src={swatches[id]} alt="" className="aspect-video w-full object-cover" />
                <span className="block px-2 py-1 text-left text-[11px] text-zinc-300">
                  {WALLPAPER_LABELS[id]}
                </span>
              </button>
            ))}
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-500">
            Original designs made for Ash Studio. To use your system wallpaper, choose Image.
          </p>
        </section>
      ) : null}

      {background.kind === 'gradient' ? (
        <section className="space-y-3">
          <Heading>Presets</Heading>
          <div className="grid grid-cols-6 gap-1.5">
            {GRADIENTS.map((preset) => (
              <button
                key={`${preset.from}-${preset.to}`}
                type="button"
                aria-label={`Gradient ${preset.from} to ${preset.to}`}
                onClick={() => {
                  setBackground({ kind: 'gradient', ...preset })
                }}
                className={`aspect-square ${swatchClass(background.from === preset.from && background.to === preset.to)}`}
                style={{
                  background: `linear-gradient(${preset.angle}deg, ${preset.from}, ${preset.to})`
                }}
              />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center justify-between text-xs text-zinc-300">
              From
              <input
                type="color"
                value={background.from}
                onChange={(event) => {
                  setBackground({ ...background, from: event.target.value }, 'bg-from')
                }}
                className="size-8 cursor-pointer rounded border border-white/10 bg-transparent"
              />
            </label>
            <label className="flex items-center justify-between text-xs text-zinc-300">
              To
              <input
                type="color"
                value={background.to}
                onChange={(event) => {
                  setBackground({ ...background, to: event.target.value }, 'bg-to')
                }}
                className="size-8 cursor-pointer rounded border border-white/10 bg-transparent"
              />
            </label>
          </div>
          <label className="block text-xs text-zinc-400">
            Angle <span className="font-mono text-zinc-200">{Math.round(background.angle)}°</span>
            <input
              type="range"
              min={0}
              max={360}
              step={1}
              value={background.angle}
              onChange={(event) => {
                setBackground({ ...background, angle: Number(event.target.value) }, 'bg-angle')
              }}
              className="mt-1 w-full accent-brand-500"
            />
          </label>
        </section>
      ) : null}

      {background.kind === 'solid' ? (
        <section className="space-y-3">
          <Heading>Color</Heading>
          <div className="grid grid-cols-8 gap-1.5">
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Color ${color}`}
                onClick={() => {
                  setBackground({ kind: 'solid', color })
                }}
                className={`aspect-square ${swatchClass(background.color === color)}`}
                style={{ background: color }}
              />
            ))}
          </div>
          <label className="flex items-center justify-between text-xs text-zinc-300">
            Custom
            <input
              type="color"
              value={background.color}
              onChange={(event) => {
                setBackground({ kind: 'solid', color: event.target.value }, 'bg-color')
              }}
              className="size-8 cursor-pointer rounded border border-white/10 bg-transparent"
            />
          </label>
        </section>
      ) : null}

      {background.kind === 'image' ? (
        <section className="space-y-3">
          <Heading>Image</Heading>
          {projectKey ? (
            <img
              src={mediaUrl(projectKey, background.fileName)}
              crossOrigin="anonymous"
              alt=""
              className="aspect-video w-full rounded-lg border border-white/10 object-cover"
            />
          ) : null}
          <button
            type="button"
            onClick={() => {
              void chooseImage()
            }}
            className="w-full rounded-lg border border-white/10 py-2 text-xs text-zinc-200 hover:bg-white/[0.07]"
          >
            Choose another image…
          </button>
          <label className="block text-xs text-zinc-400">
            Blur <span className="font-mono text-zinc-200">{background.blur}</span>
            <input
              type="range"
              min={0}
              max={40}
              step={1}
              value={background.blur}
              onChange={(event) => {
                setBackground({ ...background, blur: Number(event.target.value) }, 'bg-blur')
              }}
              className="mt-1 w-full accent-brand-500"
            />
          </label>
          <p className="text-[11px] leading-relaxed text-zinc-500">
            The picker opens your system wallpapers folder. The image is copied into the project.
          </p>
        </section>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs text-rose-300">
          {error}
        </p>
      ) : null}
    </div>
  )
}
