import { beforeEach, describe, expect, it } from 'vitest'
import {
  CUSTOM_LAYOUT_DRAFT_KEY,
  clearLayoutEditorDraft,
  readLayoutEditorDraft,
  writeLayoutEditorDraft,
} from './draftStorage'

describe('draftStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('readLayoutEditorDraft drops cells that are out of bounds', () => {
    writeLayoutEditorDraft({
      id: 'custom_1',
      name: 'T',
      grid: { rows: 2, cols: 2 },
      cells: [
        { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
        { row: 0, col: 1, rowSpan: 2, colSpan: 2 }, // overflows
        { row: 5, col: 0, rowSpan: 1, colSpan: 1 }, // out of grid
      ],
      selectedIndex: 0,
    })
    const draft = readLayoutEditorDraft()
    expect(draft).not.toBeNull()
    expect(draft!.cells).toEqual([{ row: 0, col: 0, rowSpan: 1, colSpan: 1 }])
  })

  it('clear removes the key', () => {
    writeLayoutEditorDraft({
      id: 'x',
      name: 'y',
      grid: { rows: 1, cols: 1 },
      cells: [{ row: 0, col: 0, rowSpan: 1, colSpan: 1 }],
      selectedIndex: null,
    })
    clearLayoutEditorDraft()
    expect(localStorage.getItem(CUSTOM_LAYOUT_DRAFT_KEY)).toBeNull()
  })
})
