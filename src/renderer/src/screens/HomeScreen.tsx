import { AppHeader } from '@renderer/components/AppHeader'
import { usePlatformStore } from '@renderer/stores/platform'

interface HomeScreenProps {
  onOpenSetup: () => void
}

const STACK = ['Electron', 'React', 'TypeScript', 'Vite', 'Tailwind CSS', 'Zustand']

const formatPlatform = (platform: string | undefined): string => {
  switch (platform) {
    case 'darwin':
      return 'macOS'
    case 'win32':
      return 'Windows'
    case 'linux':
      return 'Linux'
    default:
      return 'Unknown platform'
  }
}

export function HomeScreen({ onOpenSetup }: HomeScreenProps): React.JSX.Element {
  const appInfo = usePlatformStore((state) => state.appInfo)
  const permissions = usePlatformStore((state) => state.permissions)
  const missingRequired = permissions.some(
    (permission) => permission.required && permission.status !== 'granted'
  )

  return (
    <div className="relative flex min-h-screen flex-1 flex-col overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,108,255,0.18),transparent_60%)]"
      />

      <AppHeader>
        <button
          type="button"
          onClick={onOpenSetup}
          className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
        >
          System check
        </button>
      </AppHeader>

      <main className="relative z-10 flex flex-1 items-center justify-center px-8 pb-16">
        <div className="w-full max-w-2xl">
          {missingRequired ? (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3">
              <p className="text-xs text-amber-100">
                Some required permissions are missing. Recording and cursor tracking may not work.
              </p>
              <button
                type="button"
                onClick={onOpenSetup}
                className="rounded-lg bg-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-950 transition-colors hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
              >
                Finish setup
              </button>
            </div>
          ) : null}

          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-xs font-medium text-violet-200">
            <span className="size-1.5 rounded-full bg-violet-400" />
            Phase 1 complete — platform layer ready
          </div>

          <h1 className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight text-white">
            Record once.
            <br />
            <span className="bg-gradient-to-r from-violet-300 to-indigo-400 bg-clip-text text-transparent">
              Edit forever.
            </span>
          </h1>

          <p className="mt-5 max-w-xl text-pretty text-[15px] leading-relaxed text-zinc-400">
            An open-source screen recorder and editor for macOS and Windows. Raw capture is saved
            untouched, then replayed and rendered live — so zoom, cursor, background, and face cam
            stay fully editable after the fact.
          </p>

          <div className="mt-8 flex flex-wrap gap-2">
            {STACK.map((item) => (
              <span
                key={item}
                className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-300"
              >
                {item}
              </span>
            ))}
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {[
              {
                label: 'Capture',
                body: 'Screen, camera, mic, and input events saved as raw data.'
              },
              { label: 'Replay', body: 'Editor reconstructs the frame from the event log.' },
              { label: 'Render', body: 'Export the same canvas through FFmpeg.' }
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-xl border border-white/8 bg-white/[0.03] p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-violet-300">
                  {card.label}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="relative z-10 flex shrink-0 items-center justify-between border-t border-white/5 px-6 py-3 text-[11px] text-zinc-500">
        <span>
          {appInfo
            ? `${formatPlatform(appInfo.platform)} · ${appInfo.arch}`
            : 'Detecting platform…'}
        </span>
        <span className="font-mono">{appInfo?.isPackaged ? 'packaged build' : 'dev build'}</span>
      </footer>
    </div>
  )
}
