import { describe, expect, it } from 'vitest'
import {
  INSPECTOR_TABS,
  MORE_INSPECTOR_TABS,
  PRIMARY_INSPECTOR_TABS
} from './inspector-tabs'

describe('inspector navigation layout', () => {
  it('keeps the four most-used tools visible', () => {
    expect(PRIMARY_INSPECTOR_TABS.map((tab) => tab.id)).toEqual([
      'zoom',
      'speed',
      'cursor',
      'frame'
    ])
  })

  it('keeps background, face cam, and audio accessible under More', () => {
    expect(MORE_INSPECTOR_TABS.map((tab) => tab.id)).toEqual([
      'background',
      'facecam',
      'audio'
    ])
  })

  it('does not lose or duplicate an editing tool', () => {
    const allIds = INSPECTOR_TABS.map((tab) => tab.id)
    const visibleIds = [...PRIMARY_INSPECTOR_TABS, ...MORE_INSPECTOR_TABS].map((tab) => tab.id)
    expect(visibleIds).toHaveLength(allIds.length)
    expect(new Set(visibleIds).size).toBe(allIds.length)
    expect(visibleIds.slice().sort()).toEqual(allIds.slice().sort())
  })
})
