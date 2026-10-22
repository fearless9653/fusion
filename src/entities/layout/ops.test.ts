import { describe, expect, it } from 'vitest'
import {
  addCell,
  autoFillEmptyCells,
  cellArea,
  cellsOverlap,
  createEmptyGridCells,
  createUnitGridCells,
  inBounds,
  isFullCoverage,
  moveCell,
  removeCell,
  resizeCell,
  totalCoverage,
} from './ops'
import {
  ensureTemplateCatalog,
  getTemplate,
  listTemplates,
  registerTemplate,
  resetBuiltinTemplates,
} from './templates'
import { validateLayout } from './validate'
import type { LayoutCell, LayoutGrid } from './types'

const grid2: LayoutGrid = { rows: 2, cols: 2 }

describe('coverage helpers', () => {
  it('computes cell area and total coverage', () => {
    const cells: LayoutCell[] = [
      { row: 0, col: 0, rowSpan: 2, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
    ]
    expect(cellArea(cells[0]!)).toBe(2)
    expect(totalCoverage(cells)).toBe(3)
  })

  it('detects in-bounds and overlaps', () => {
    expect(inBounds({ row: 0, col: 0, rowSpan: 2, colSpan: 2 }, grid2)).toBe(true)
    expect(inBounds({ row: 1, col: 1, rowSpan: 2, colSpan: 1 }, grid2)).toBe(false)
    expect(
      cellsOverlap(
        { row: 0, col: 0, rowSpan: 2, colSpan: 1 },
        { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      ),
    ).toBe(true)
    expect(
      cellsOverlap(
        { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
        { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      ),
    ).toBe(false)
  })

  it('reports full coverage only when non-overlapping and complete', () => {
    const full = {
      grid: grid2,
      cells: createUnitGridCells(2, 2),
    }
    expect(isFullCoverage(full)).toBe(true)
    expect(
      isFullCoverage({
        grid: grid2,
        cells: [{ row: 0, col: 0, rowSpan: 1, colSpan: 1 }],
      }),
    ).toBe(false)
  })
})

describe('cell ops', () => {
  it('createEmptyGridCells returns no cells', () => {
    expect(createEmptyGridCells(3, 3)).toEqual([])
  })

  it('autoFillEmptyCells fills holes with 1×1 cells', () => {
    const existing: LayoutCell[] = [{ row: 0, col: 0, rowSpan: 1, colSpan: 1 }]
    const filled = autoFillEmptyCells(grid2, existing)
    expect(filled).toHaveLength(4)
    expect(totalCoverage(filled)).toBe(4)
    expect(isFullCoverage({ grid: grid2, cells: filled })).toBe(true)
  })

  it('addCell rejects overlap and out-of-bounds', () => {
    const cells: LayoutCell[] = [{ row: 0, col: 0, rowSpan: 1, colSpan: 1 }]
    expect(addCell(grid2, cells, { row: 0, col: 0, rowSpan: 1, colSpan: 1 }).ok).toBe(false)
    expect(addCell(grid2, cells, { row: 2, col: 0, rowSpan: 1, colSpan: 1 }).ok).toBe(false)
    const ok = addCell(grid2, cells, { row: 0, col: 1, rowSpan: 1, colSpan: 1 })
    expect(ok.ok).toBe(true)
    if (ok.ok) expect(ok.cells).toHaveLength(2)
  })

  it('removeCell / moveCell / resizeCell with collision rejection', () => {
    const cells = createUnitGridCells(2, 2)
    const removed = removeCell(cells, 3)
    expect(removed.ok).toBe(true)

    const movedBad = moveCell(grid2, cells, 0, { row: 0, col: 1 })
    expect(movedBad.ok).toBe(false)

    const resizedBad = resizeCell(grid2, cells, 0, { rowSpan: 2, colSpan: 2 })
    expect(resizedBad.ok).toBe(false)

    // After clearing others, resize succeeds
    const only = [{ row: 0, col: 0, rowSpan: 1, colSpan: 1 }]
    const resized = resizeCell(grid2, only, 0, { rowSpan: 2, colSpan: 2 })
    expect(resized.ok).toBe(true)
    if (resized.ok) {
      expect(resized.cells[0]).toEqual({ row: 0, col: 0, rowSpan: 2, colSpan: 2 })
    }
  })
})

describe('templates', () => {
  it('lists 135 built-in templates with full coverage', async () => {
    resetBuiltinTemplates()
    await ensureTemplateCatalog()
    const list = listTemplates()
    expect(list.length).toBe(135)
    for (const tpl of list) {
      expect(validateLayout(tpl).id).toBe(tpl.id)
      expect(isFullCoverage(tpl)).toBe(true)
    }
  })

  it('registers and retrieves a custom template', () => {
    resetBuiltinTemplates()
    registerTemplate({
      schemaVersion: 1,
      id: 'tpl_test_extra',
      name: 'Extra',
      imageCount: 1,
      grid: { rows: 1, cols: 1 },
      cells: [{ row: 0, col: 0, rowSpan: 1, colSpan: 1 }],
    })
    expect(getTemplate('tpl_test_extra')?.name).toBe('Extra')
    resetBuiltinTemplates()
    expect(getTemplate('tpl_test_extra')).toBeUndefined()
  })
})
