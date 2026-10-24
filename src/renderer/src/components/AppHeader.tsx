import type { ReactNode } from 'react'
import { usePlatformStore } from '@renderer/stores/platform'
import { Logo } from './Logo'

export function AppHeader({ children }: { children?: ReactNode }): React.JSX.Element {
  const platform = usePlatformStore((state) => state.appInfo?.platform)
  const isMac = platform === 'darwin'

  return (
    <header
      className={`sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-white/[0.04] bg-canvas/80 pr-5 backdrop-blur-xl [-webkit-app-region:drag] ${
        isMac ? 'pl-24' : 'pl-6'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <Logo />
        <span className="text-sm font-semibold tracking-tight text-zinc-100">
          Ash Studio Recorder
        </span>
      </div>
      {children ? (
        <div className="flex items-center gap-2 [-webkit-app-region:no-drag]">{children}</div>
      ) : null}
    </header>
  )
}
