import { describe, expect, it } from 'vitest'
import { isFullCoverage, parseLayoutDefinition, safeParseLayoutDefinition } from './schema'
import type { LayoutDefinition } from './types'

const validFourCell: LayoutDefinition = {
  schemaVersion: 1,
  id: 'custom_1730000000000',
  name: 'Custom 4',
  imageCount: 4,
  grid: { rows: 6, cols: 6 },
  cells: [
    { row: 0, col: 0, rowSpan: 3, colSpan: 3 },
    { row: 0, col: 3, rowSpan: 3, colSpan: 3 },
    { row: 3, col: 0, rowSpan: 3, colSpan: 2 },
    { row: 3, col: 2, rowSpan: 3, colSpan: 4 },
  ],
}

describe('layoutDefinitionSchema', () => {
  it('accepts a valid full-coverage layout from the SPEC example', () => {
    const parsed = parseLayoutDefinition(validFourCell)
    expect(parsed.id).toBe('custom_1730000000000')
    expect(parsed.cells).toHaveLength(4)
    expect(isFullCoverage(parsed)).toBe(true)
  })

  it('rejects wrong schemaVersion', () => {
    const result = safeParseLayoutDefinition({ ...validFourCell, schemaVersion: 2 })
    expect(result.success).toBe(false)
  })

  it('rejects when imageCount !== cells.length', () => {
    const result = safeParseLayoutDefinition({ ...validFourCell, imageCount: 3 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('imageCount'))).toBe(true)
    }
  })

  it('rejects out-of-bounds cells', () => {
    const result = safeParseLayoutDefinition({
      ...validFourCell,
      cells: [{ row: 5, col: 5, rowSpan: 2, colSpan: 2 }],
      imageCount: 1,
    })
    expect(result.success).toBe(false)
  })

  it('rejects overlapping cells', () => {
    const result = safeParseLayoutDefinition({
      schemaVersion: 1,
      id: 'overlap',
      name: 'Overlap',
      imageCount: 2,
      grid: { rows: 2, cols: 2 },
      cells: [
        { row: 0, col: 0, rowSpan: 2, colSpan: 2 },
        { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('accepts a non-full-coverage but non-overlapping layout structurally', () => {
    const partial: LayoutDefinition = {
      schemaVersion: 1,
      id: 'partial',
      name: 'Partial',
      imageCount: 1,
      grid: { rows: 2, cols: 2 },
      cells: [{ row: 0, col: 0, rowSpan: 1, colSpan: 1 }],
    }
    expect(safeParseLayoutDefinition(partial).success).toBe(true)
    expect(isFullCoverage(partial)).toBe(false)
  })
})
