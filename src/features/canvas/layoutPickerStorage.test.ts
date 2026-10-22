import { beforeEach, describe, expect, it } from 'vitest'
import {
  LAYOUT_FAVORITES_KEY,
  LAYOUT_GROUPS_EXPANDED_KEY,
  readExpandedGroupCounts,
  readFavoriteIds,
  writeExpandedGroupCounts,
  writeFavoriteIds,
} from './layoutPickerStorage'

describe('layoutPickerStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults expanded groups to all counts when unset', () => {
    expect(readExpandedGroupCounts([1, 2, 4])).toEqual([1, 2, 4])
  })

  it('round-trips expanded group counts and drops unknown counts', () => {
    writeExpandedGroupCounts([2, 99, 4])
    expect(localStorage.getItem(LAYOUT_GROUPS_EXPANDED_KEY)).toBeTruthy()
    expect(readExpandedGroupCounts([1, 2, 4])).toEqual([2, 4])
  })

  it('treats empty expanded list as all collapsed', () => {
    writeExpandedGroupCounts([])
    expect(readExpandedGroupCounts([1, 2, 4])).toEqual([])
  })

  it('round-trips favorite id order', () => {
    expect(readFavoriteIds()).toEqual([])
    writeFavoriteIds(['tpl_a', 'tpl_b'])
    expect(localStorage.getItem(LAYOUT_FAVORITES_KEY)).toBeTruthy()
    expect(readFavoriteIds()).toEqual(['tpl_a', 'tpl_b'])
    writeFavoriteIds([])
    expect(readFavoriteIds()).toEqual([])
  })

  it('ignores non-string favorite entries', () => {
    localStorage.setItem(LAYOUT_FAVORITES_KEY, JSON.stringify(['ok', 1, null, '']))
    expect(readFavoriteIds()).toEqual(['ok'])
  })
})
