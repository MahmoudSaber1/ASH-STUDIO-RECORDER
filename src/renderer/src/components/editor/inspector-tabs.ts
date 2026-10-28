/** Keep every editing tool reachable without crowding the 320px inspector. */
export const INSPECTOR_TABS = [
  { id: 'zoom', label: 'Zoom' },
  { id: 'speed', label: 'Speed' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'background', label: 'Background' },
  { id: 'frame', label: 'Frame' },
  { id: 'facecam', label: 'Face cam' },
  { id: 'audio', label: 'Audio' }
] as const

export type InspectorTab = (typeof INSPECTOR_TABS)[number]['id']

const PRIMARY_IDS: ReadonlySet<InspectorTab> = new Set(['zoom', 'speed', 'cursor', 'frame'])

export const PRIMARY_INSPECTOR_TABS = INSPECTOR_TABS.filter((tab) => PRIMARY_IDS.has(tab.id))
export const MORE_INSPECTOR_TABS = INSPECTOR_TABS.filter((tab) => !PRIMARY_IDS.has(tab.id))
