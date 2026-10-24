import { useState } from 'react'
import { AppHeader } from '@renderer/components/AppHeader'
import { PermissionCard } from '@renderer/components/PermissionCard'
import { PERMISSION_META } from '@renderer/lib/permissions'
import { usePlatformStore } from '@renderer/stores/platform'

interface SetupScreenProps {
  onContinue: () => void
  onSkip: () => void
}

const formatPlatform = (platform: string | undefined): string => {
  switch (platform) {
    case 'darwin':
      return 'macOS'
    case 'win32':
      return 'Windows'
    case 'linux':
      return 'Linux'
    default:
      return 'Detecting platform'
  }
}

export function SetupScreen({ onContinue, onSkip }: SetupScreenProps): React.JSX.Element {
  const appInfo = usePlatformStore((state) => state.appInfo)
  const permissions = usePlatformStore((state) => state.permissions)
  const sources = usePlatformStore((state) => state.sources)
  const pendingKind = usePlatformStore((state) => state.pendingKind)
  const error = usePlatformStore((state) => state.error)
  const requestPermission = usePlatformStore((state) => state.requestPermission)
  const refreshPermissions = usePlatformStore((state) => state.refreshPermissions)
  const [refreshing, setRefreshing] = useState(false)

  const required = permissions.filter((permission) => permission.required)
  const missing = required.filter((permission) => permission.status !== 'granted')
  const ready = required.length > 0 && missing.length === 0
  const screenReady = permissions.some(
    (permission) => permission.kind === 'screen' && permission.status === 'granted'
  )
  const screenCount = sources.filter((source) => source.kind === 'screen').length
  const windowCount = sources.filter((source) => source.kind === 'window').length

  const handleRecheck = async (): Promise<void> => {
    setRefreshing(true)
    await refreshPermissions()
    setRefreshing(false)
  }

  return (
    <div className="relative flex min-h-screen flex-1 flex-col">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,108,255,0.16),transparent_55%)]"
      />

      <AppHeader>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[11px] text-zinc-400">
          {formatPlatform(appInfo?.platform)} · {appInfo?.arch ?? '—'}
        </span>
      </AppHeader>

      <main className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-6 pb-16 pt-6">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-xs font-medium text-violet-200">
            <span className="size-1.5 rounded-full bg-violet-400" />
            Phase 1 · System check
          </div>
          <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight text-white">
            Let&apos;s get access sorted.
          </h1>
          <p className="mt-3 max-w-xl text-pretty text-sm leading-relaxed text-zinc-400">
            Ash Studio needs a few permissions before it can record. Everything stays on your device
            — nothing is uploaded.
          </p>
        </div>

        {error ? (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-xs text-rose-200"
          >
            {error}
          </div>
        ) : null}

        <div className="space-y-3">
          {permissions.map((permission) => (
            <PermissionCard
              key={permission.kind}
              permission={permission}
              platform={appInfo?.platform}
              pending={pendingKind === permission.kind}
              onRequest={(kind) => {
                void requestPermission(kind)
              }}
            />
          ))}
        </div>

        {screenReady ? (
          <p className="mt-4 text-xs text-zinc-500">
            Detected {screenCount} {screenCount === 1 ? 'display' : 'displays'} and {windowCount}{' '}
            {windowCount === 1 ? 'window' : 'windows'}.
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onContinue}
            disabled={!ready}
            className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
          >
            Continue
          </button>

          <button
            type="button"
            onClick={() => {
              void handleRecheck()
            }}
            disabled={refreshing}
            aria-busy={refreshing}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
          >
            {refreshing ? 'Checking…' : 'Recheck permissions'}
          </button>

          <button
            type="button"
            onClick={onSkip}
            className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
          >
            Skip for now
          </button>
        </div>

        {!ready ? (
          <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
            Grant{' '}
            {missing.map((permission) => PERMISSION_META[permission.kind].title).join(' and ')} to
            continue, or skip and finish setup later from the system check.
          </p>
        ) : null}
      </main>
    </div>
  )
}
