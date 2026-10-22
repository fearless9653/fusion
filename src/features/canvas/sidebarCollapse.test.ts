import { beforeEach, describe, expect, it } from 'vitest'
import { SIDEBAR_LEFT_KEY, readSidebarCollapsed, writeSidebarCollapsed } from './sidebarCollapse'

describe('sidebarCollapse storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to fallback when unset', () => {
    expect(readSidebarCollapsed(SIDEBAR_LEFT_KEY)).toBe(false)
    expect(readSidebarCollapsed(SIDEBAR_LEFT_KEY, true)).toBe(true)
  })

  it('round-trips collapsed flags', () => {
    writeSidebarCollapsed(SIDEBAR_LEFT_KEY, true)
    expect(readSidebarCollapsed(SIDEBAR_LEFT_KEY)).toBe(true)
    writeSidebarCollapsed(SIDEBAR_LEFT_KEY, false)
    expect(readSidebarCollapsed(SIDEBAR_LEFT_KEY)).toBe(false)
  })
})
