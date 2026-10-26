import { useEffect, useState } from 'react'
import type { SettingsInfo } from '@shared/settings'
import { AppHeader } from '@renderer/components/AppHeader'
import { NavTabs } from '@renderer/components/NavTabs'
import { getThemePreference, setThemePreference, type ThemePreference } from '@renderer/lib/theme'

export function SettingsScreen(): React.JSX.Element {
  const [info, setInfo] = useState<SettingsInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [theme, setTheme] = useState<ThemePreference>(getThemePreference)

  useEffect(() => {
    let active = true
    window.api.settings
      .get()
      .then((next) => {
        if (active) setInfo(next)
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : 'Could not read settings')
      })
    return () => {
      active = false
    }
  }, [])

  const run = (action: () => Promise<SettingsInfo | null>): void => {
    setError(null)
    action()
      .then((next) => {
        if (next) setInfo(next)
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : 'Something went wrong')
      })
  }

  return (
    <div className="relative flex min-h-screen flex-1 flex-col">
      <AppHeader>
        <NavTabs />
      </AppHeader>

      <main className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-6 pb-12 pt-6">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Settings</h1>
        <p className="mt-1 text-xs text-zinc-500">Preferences are stored on this machine.</p>

        {error ? (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-xs text-rose-200"
          >
            {error}
          </div>
        ) : null}

        {info ? (
          <div className="mt-8 space-y-6">
            <section className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
              <h2 className="text-sm font-semibold text-zinc-100">Recordings folder</h2>
              <p className="mt-1 text-xs text-zinc-500">
                New recordings are saved here. Existing projects stay where they are.
              </p>
              <p className="mt-3 break-all rounded-lg bg-black/30 px-3 py-2 font-mono text-[11px] text-zinc-300">
                {info.effectiveRecordingsFolder}
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    run(() => window.api.settings.chooseRecordingsFolder())
                  }}
                  className="rounded-lg bg-violet-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-400"
                >
                  Choose folder
                </button>
                <button
                  type="button"
                  disabled={info.settings.recordingsFolder === null}
                  onClick={() => {
                    run(() => window.api.settings.resetRecordingsFolder())
                  }}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.06] disabled:opacity-40"
                >
                  Use default
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
              <h2 className="text-sm font-semibold text-zinc-100">Appearance</h2>
              <p className="mt-1 text-xs text-zinc-500">
                System follows your macOS or Windows setting.
              </p>
              <div
                role="radiogroup"
                aria-label="Theme"
                className="mt-4 inline-flex rounded-lg border border-white/10 bg-black/20 p-0.5"
              >
                {(['system', 'light', 'dark'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={theme === option}
                    onClick={() => {
                      setThemePreference(option)
                      setTheme(option)
                    }}
                    className={`rounded-md px-4 py-1.5 text-xs font-medium capitalize ${
                      theme === option
                        ? 'bg-white/[0.1] text-white'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
              <h2 className="text-sm font-semibold text-zinc-100">Diagnostics</h2>
              <p className="mt-1 text-xs text-zinc-500">
                Warnings and errors are written to a local log file. Nothing is sent anywhere.
              </p>
              <p className="mt-3 break-all rounded-lg bg-black/30 px-3 py-2 font-mono text-[11px] text-zinc-300">
                {info.logFile}
              </p>
              <button
                type="button"
                onClick={() => {
                  run(async () => {
                    await window.api.settings.openLogs()
                    return null
                  })
                }}
                className="mt-4 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.06]"
              >
                Open logs folder
              </button>
            </section>

            <section className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
              <h2 className="text-sm font-semibold text-zinc-100">Keyboard shortcuts</h2>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-xs text-zinc-400">
                <dt className="font-mono text-zinc-300">⌘⇧R / Ctrl⇧R</dt>
                <dd>Start recording</dd>
                <dt className="font-mono text-zinc-300">⌘⇧P / Ctrl⇧P</dt>
                <dd>Pause or resume</dd>
                <dt className="font-mono text-zinc-300">⌘⇧S / Ctrl⇧S</dt>
                <dd>Stop recording</dd>
                <dt className="font-mono text-zinc-300">Space</dt>
                <dd>Play or pause in the editor</dd>
                <dt className="font-mono text-zinc-300">← / →</dt>
                <dd>Step 5 s in the editor (Shift: 1 s)</dd>
                <dt className="font-mono text-zinc-300">⌘Z / ⇧⌘Z</dt>
                <dd>Undo and redo</dd>
              </dl>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  )
}
