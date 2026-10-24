import { create } from 'zustand'

export type Route = { name: 'record' } | { name: 'library' } | { name: 'editor'; key: string }

interface NavigationStore {
  route: Route
  go: (route: Route) => void
}

/** Minimal router: the app has three top-level views, so no router library is needed. */
export const useNavigation = create<NavigationStore>((set) => ({
  route: { name: 'record' },
  go: (route) => {
    set({ route })
  }
}))
