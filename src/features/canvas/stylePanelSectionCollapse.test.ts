import { beforeEach, describe, expect, it } from 'vitest'
import {
  STYLE_PANEL_ASPECT_OPEN_KEY,
  readStylePanelSectionOpen,
  writeStylePanelSectionOpen,
} from './stylePanelSectionCollapse'

describe('stylePanelSectionCollapse storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round-trips via wrapper with feature key', () => {
    writeStylePanelSectionOpen(STYLE_PANEL_ASPECT_OPEN_KEY, false)
    expect(readStylePanelSectionOpen(STYLE_PANEL_ASPECT_OPEN_KEY)).toBe(false)
  })
})
