import { beforeEach, describe, expect, it } from 'vitest'
import type { LayoutDefinition } from '@/entities/layout'
import {
  CUSTOM_LAYOUTS_KEY,
  getCustomLayout,
  listCustomLayouts,
  prependFavoriteId,
  readCustomLayoutMap,
  rememberAppliedCustomLayout,
  upsertCustomLayout,
} from './customLayoutRegistry'
import { LAYOUT_FAVORITES_KEY, readFavoriteIds, writeFavoriteIds } from './layoutPickerStorage'

const sample: LayoutDefinition = {
  schemaVersion: 1,
  id: 'custom_test_1',
  name: 'My custom',
  imageCount: 2,
  grid: { rows: 1, cols: 2 },
  cells: [
    { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
    { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
  ],
}

describe('customLayoutRegistry', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('uses a stable storage key', () => {
    expect(CUSTOM_LAYOUTS_KEY).toBe('fusion:custom-layouts')
  })

  it('upserts and reads back a layout', () => {
    expect(upsertCustomLayout(sample)?.id).toBe('custom_test_1')
    expect(getCustomLayout('custom_test_1')?.name).toBe('My custom')
    expect(listCustomLayouts()).toHaveLength(1)
    expect(localStorage.getItem(CUSTOM_LAYOUTS_KEY)).toBeTruthy()
  })

  it('replaces an existing id on upsert', () => {
    upsertCustomLayout(sample)
    upsertCustomLayout({ ...sample, name: 'Renamed' })
    expect(getCustomLayout('custom_test_1')?.name).toBe('Renamed')
    expect(Object.keys(readCustomLayoutMap())).toHaveLength(1)
  })

  it('drops corrupt / mismatched entries on read', () => {
    localStorage.setItem(
      CUSTOM_LAYOUTS_KEY,
      JSON.stringify({
        bad: { nope: true },
        custom_test_1: sample,
        wrong_key: { ...sample, id: 'other_id' },
      }),
    )
    const map = readCustomLayoutMap()
    expect(Object.keys(map)).toEqual(['custom_test_1'])
  })

  it('prependFavoriteId inserts once at front', () => {
    writeFavoriteIds(['tpl_a', 'tpl_b'])
    expect(prependFavoriteId('custom_test_1')).toEqual(['custom_test_1', 'tpl_a', 'tpl_b'])
    expect(prependFavoriteId('custom_test_1')).toEqual(['custom_test_1', 'tpl_a', 'tpl_b'])
    expect(readFavoriteIds()).toEqual(['custom_test_1', 'tpl_a', 'tpl_b'])
    expect(localStorage.getItem(LAYOUT_FAVORITES_KEY)).toBeTruthy()
  })

  it('rememberAppliedCustomLayout upserts and favorites', () => {
    const stored = rememberAppliedCustomLayout(sample)
    expect(stored?.id).toBe('custom_test_1')
    expect(getCustomLayout('custom_test_1')).toBeTruthy()
    expect(readFavoriteIds()[0]).toBe('custom_test_1')
    // second apply does not duplicate favorite
    rememberAppliedCustomLayout({ ...sample, name: 'Again' })
    expect(readFavoriteIds().filter((id) => id === 'custom_test_1')).toHaveLength(1)
    expect(getCustomLayout('custom_test_1')?.name).toBe('Again')
  })
})
