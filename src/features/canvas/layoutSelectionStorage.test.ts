import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getTemplate, type LayoutDefinition } from '@/entities/layout'
import { getCustomLayout, upsertCustomLayout } from './customLayoutRegistry'
import {
  SELECTED_LAYOUT_KEY,
  readSelectedLayoutId,
  resolvePersistedLayout,
  writeSelectedLayoutId,
} from './layoutSelectionStorage'
import { setStylePersistDebounceMsForTests, useCollageStore } from './collageStore'
import { STYLE_STORAGE_KEY, readPersistedStyle } from './stylePersistence'

function tinyCustom(id: string): LayoutDefinition {
  return {
    schemaVersion: 1,
    id,
    name: 'Custom pick',
    imageCount: 1,
    grid: { rows: 1, cols: 1 },
    cells: [{ row: 0, col: 0, rowSpan: 1, colSpan: 1 }],
  }
}

describe('layoutSelectionStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round-trips selected layout id and ignores empty', () => {
    expect(readSelectedLayoutId()).toBeNull()
    writeSelectedLayoutId('  tpl_split_h  ')
    expect(localStorage.getItem(SELECTED_LAYOUT_KEY)).toBe('tpl_split_h')
    expect(readSelectedLayoutId()).toBe('tpl_split_h')
    writeSelectedLayoutId('   ')
    expect(readSelectedLayoutId()).toBe('tpl_split_h')
  })

  it('resolvePersistedLayout finds core then custom', () => {
    writeSelectedLayoutId('tpl_5_center')
    expect(resolvePersistedLayout()?.id).toBe('tpl_5_center')

    const custom = tinyCustom('custom_sel_1')
    upsertCustomLayout(custom)
    writeSelectedLayoutId(custom.id)
    expect(resolvePersistedLayout()?.id).toBe(custom.id)
    expect(getCustomLayout(custom.id)?.id).toBe(custom.id)

    writeSelectedLayoutId('missing_layout_xyz')
    expect(resolvePersistedLayout()).toBeNull()
  })
})

describe('useCollageStore layout selection persistence', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    setStylePersistDebounceMsForTests(0)
    localStorage.clear()
  })

  afterEach(() => {
    setStylePersistDebounceMsForTests(null)
    localStorage.clear()
  })

  it('setLayout writes selected id; resetStyles leaves it', async () => {
    const store = useCollageStore()
    const tpl = getTemplate('tpl_split_h')!
    store.setLayout(tpl)
    expect(readSelectedLayoutId()).toBe('tpl_split_h')

    store.setStyle({ spacing: 40 })
    await store.flushStylePersistForTests()
    expect(readPersistedStyle()?.spacing).toBe(40)

    store.resetStyles()
    await new Promise((r) => setTimeout(r, 0))
    expect(localStorage.getItem(STYLE_STORAGE_KEY)).toBeNull()
    expect(readSelectedLayoutId()).toBe('tpl_split_h')
    expect(store.layout?.id).toBe('tpl_split_h')
  })

  it('applyCustomLayout persists custom id', () => {
    const store = useCollageStore()
    const custom = tinyCustom('custom_sel_apply')
    store.applyCustomLayout(custom)
    expect(readSelectedLayoutId()).toBe(custom.id)
    expect(getCustomLayout(custom.id)?.id).toBe(custom.id)
  })
})
