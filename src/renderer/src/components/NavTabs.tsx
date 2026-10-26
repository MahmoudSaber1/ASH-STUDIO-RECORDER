import { useNavigation } from '@renderer/stores/navigation'

const TABS = [
  { name: 'record', label: 'Record' },
  { name: 'library', label: 'Projects' },
  { name: 'settings', label: 'Settings' }
] as const

/** Top-level navigation. Editor views sit outside it and have their own back button. */
export function NavTabs(): React.JSX.Element {
  const route = useNavigation((state) => state.route)
  const go = useNavigation((state) => state.go)

  return (
    <div className="flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
      {TABS.map((tab) => {
        const active = route.name === tab.name
        return (
          <button
            key={tab.name}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => {
              go({ name: tab.name })
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400 ${
              active ? 'bg-white/[0.09] text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
