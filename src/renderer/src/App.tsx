import { useEffect, useState } from 'react'
import { Logo } from '@renderer/components/Logo'
import { EditorScreen } from '@renderer/screens/EditorScreen'
import { LibraryScreen } from '@renderer/screens/LibraryScreen'
import { RecorderScreen } from '@renderer/screens/RecorderScreen'
import { SetupScreen } from '@renderer/screens/SetupScreen'
import { usePlatformStore } from '@renderer/stores/platform'
import { useNavigation } from '@renderer/stores/navigation'

type View = 'setup' | 'home'

function BootScreen(): React.JSX.Element {
  return (
    <div className="relative flex min-h-screen flex-1 items-center justify-center overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(124,108,255,0.14),transparent_60%)]"
      />
      <div className="relative flex items-center gap-3">
        <Logo className="size-9" />
        <div>
          <p className="text-sm font-medium text-zinc-200">Ash Studio Recorder</p>
          <p className="text-xs text-zinc-500">Checking system access…</p>
        </div>
      </div>
    </div>
  )
}

interface ErrorScreenProps {
  message: string | null
  onRetry: () => void
}

function ErrorScreen({ message, onRetry }: ErrorScreenProps): React.JSX.Element {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] p-6">
        <h1 className="text-sm font-semibold text-rose-100">Could not read system permissions</h1>
        <p className="mt-2 text-xs leading-relaxed text-rose-200/80">
          {message ?? 'An unexpected error occurred while talking to the platform layer.'}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg bg-rose-300 px-4 py-2 text-xs font-semibold text-rose-950 transition-colors hover:bg-rose-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300"
        >
          Try again
        </button>
      </div>
    </div>
  )
}

export default function App(): React.JSX.Element {
  const status = usePlatformStore((state) => state.status)
  const error = usePlatformStore((state) => state.error)
  const load = usePlatformStore((state) => state.load)
  const [view, setView] = useState<View>('setup')
  const route = useNavigation((state) => state.route)

  useEffect(() => {
    void load()
  }, [load])

  if (status === 'idle' || status === 'loading') {
    return <BootScreen />
  }

  if (status === 'error') {
    return (
      <ErrorScreen
        message={error}
        onRetry={() => {
          void load()
        }}
      />
    )
  }

  if (view === 'setup') {
    return (
      <SetupScreen
        onContinue={() => {
          setView('home')
        }}
        onSkip={() => {
          setView('home')
        }}
      />
    )
  }

  if (route.name === 'editor') {
    return <EditorScreen key={route.key} projectKey={route.key} />
  }

  if (route.name === 'library') {
    return <LibraryScreen />
  }

  return (
    <RecorderScreen
      onOpenSetup={() => {
        setView('setup')
      }}
    />
  )
}
