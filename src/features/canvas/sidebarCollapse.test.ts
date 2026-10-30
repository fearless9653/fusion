import { beforeEach, describe, expect, it } from 'vitest'
import { SIDEBAR_LEFT_KEY, readSidebarCollapsed, writeSidebarCollapsed } from './sidebarCollapse'

describe('sidebarCollapse storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round-trips via wrapper with feature key', () => {
    writeSidebarCollapsed(SIDEBAR_LEFT_KEY, true)
    expect(readSidebarCollapsed(SIDEBAR_LEFT_KEY)).toBe(true)
  })
})
