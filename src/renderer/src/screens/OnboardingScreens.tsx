import { useEffect, useState } from 'react'
import type { SettingsInfo } from '@shared/settings'
import { Logo } from '@renderer/components/Logo'
import { usePlatformStore } from '@renderer/stores/platform'

function StepShell({
  step,
  children
}: {
  step: number
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="relative flex min-h-screen flex-1 flex-col items-center justify-center px-6 py-16 [-webkit-app-region:drag]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(166,234,0,0.18),transparent_55%)]"
      />
      <div className="relative w-full max-w-xl [-webkit-app-region:no-drag]">
        <p className="mb-6 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Step {step} of 3
        </p>
        {children}
      </div>
    </div>
  )
}

const POINTS = [
  {
    title: 'Record raw, polish later',
    body: 'Your screen, camera, microphone and cursor are saved separately, so zoom, cursor style and backgrounds stay editable.'
  },
  {
    title: 'Automatic zoom',
    body: 'Clicks become smooth zooms in the editor. You can adjust or remove any of them.'
  },
  {
    title: 'Private by design',
    body: 'Everything stays on this computer. There is no account, no upload and no analytics.'
  }
]

/** Step 1: what the app does, where recordings go, and the privacy promise. */
export function WelcomeScreen({ onNext }: { onNext: () => void }): React.JSX.Element {
  const [info, setInfo] = useState<SettingsInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    window.api.settings
      .get()
      .then((next) => {
        if (active) setInfo(next)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  const chooseFolder = (): void => {
    setError(null)
    window.api.settings
      .chooseRecordingsFolder()
      .then((next) => {
        if (next) setInfo(next)
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : 'Could not change the folder')
      })
  }

  return (
    <StepShell step={1}>
      <div className="flex flex-col items-center text-center">
        <Logo className="size-12" />
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white">
          Welcome to Ash Studio Recorder
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          A free, open-source screen recorder and editor.
        </p>
      </div>

      <ul className="mt-8 space-y-3">
        {POINTS.map((point) => (
          <li
            key={point.title}
            className="rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3"
          >
            <p className="text-sm font-medium text-zinc-100">{point.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">{point.body}</p>
          </li>
        ))}
      </ul>

      <div className="mt-6 rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3">
        <p className="text-xs font-medium text-zinc-300">Recordings are saved to</p>
        <p className="mt-1 break-all font-mono text-[11px] text-zinc-400">
          {info?.effectiveRecordingsFolder ?? '…'}
        </p>
        <button
          type="button"
          onClick={chooseFolder}
          className="mt-2 text-xs font-medium text-brand-300 hover:text-brand-200"
        >
          Change folder
        </button>
        {error ? <p className="mt-1 text-xs text-rose-300">{error}</p> : null}
      </div>

      <button
        type="button"
        onClick={onNext}
        className="mt-8 w-full rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white hover:bg-brand-400"
      >
        Get started
      </button>
    </StepShell>
  )
}

const SHORTCUTS_MAC: Array<[string, string]> = [
  ['⌘⇧R', 'Start recording'],
  ['⌘⇧P', 'Pause or resume'],
  ['⌘⇧S', 'Stop and save']
]
const SHORTCUTS_OTHER: Array<[string, string]> = [
  ['Ctrl+Shift+R', 'Start recording'],
  ['Ctrl+Shift+P', 'Pause or resume'],
  ['Ctrl+Shift+S', 'Stop and save']
]

/** Step 3: the shortcuts to remember, then into the app. */
export function ReadyScreen({ onFinish }: { onFinish: () => void }): React.JSX.Element {
  const platform = usePlatformStore((state) => state.appInfo?.platform)
  const shortcuts = platform === 'darwin' ? SHORTCUTS_MAC : SHORTCUTS_OTHER

  return (
    <StepShell step={3}>
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-white">You're ready</h1>
        <p className="mt-2 text-sm text-zinc-400">
          These shortcuts work from any app while Ash Studio Recorder is open.
        </p>
      </div>

      <dl className="mt-8 divide-y divide-white/5 rounded-xl border border-white/8 bg-white/[0.025]">
        {shortcuts.map(([keys, action]) => (
          <div key={keys} className="flex items-center justify-between px-4 py-3">
            <dt className="text-sm text-zinc-300">{action}</dt>
            <dd className="rounded-md border border-white/10 bg-black/20 px-2 py-1 font-mono text-xs text-zinc-200">
              {keys}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 text-center text-xs text-zinc-500">
        You can change permissions later from System check, and preferences from Settings.
      </p>

      <button
        type="button"
        onClick={onFinish}
        className="mt-8 w-full rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white hover:bg-brand-400"
      >
        Start recording
      </button>
    </StepShell>
  )
}
