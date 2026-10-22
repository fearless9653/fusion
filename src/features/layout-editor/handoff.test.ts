import { beforeEach, describe, expect, it } from 'vitest'
import { getTemplate } from '@/entities/layout'
import {
  CUSTOM_LAYOUT_HANDOFF_KEY,
  clearCustomLayoutHandoff,
  readCustomLayoutHandoff,
  writeCustomLayoutHandoff,
} from './handoff'

describe('custom layout handoff', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('uses a stable storage key', () => {
    expect(CUSTOM_LAYOUT_HANDOFF_KEY).toBe('fusion:custom-layout-handoff')
  })

  it('round-trips a valid layout', () => {
    const tpl = getTemplate('tpl_split_h')!
    writeCustomLayoutHandoff(tpl)
    const read = readCustomLayoutHandoff()
    expect(read?.id).toBe('tpl_split_h')
    expect(read?.cells).toHaveLength(2)
    clearCustomLayoutHandoff()
    expect(readCustomLayoutHandoff()).toBeNull()
  })

  it('returns null for corrupt payload', () => {
    localStorage.setItem(CUSTOM_LAYOUT_HANDOFF_KEY, '{not-json')
    expect(readCustomLayoutHandoff()).toBeNull()
  })
})
