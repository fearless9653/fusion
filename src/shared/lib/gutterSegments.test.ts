import { describe, expect, it } from 'vitest'
import type { LayoutCell } from '@/entities/layout'
import { measureSharedGutterSegments } from './gutterSegments'

const gap = 10
/** 2 tracks of 100 + one gap. */
const grid = 210

describe('measureSharedGutterSegments', () => {
  it('emits one full-span gutter per axis for a regular 2x2 grid', () => {
    const cells: LayoutCell[] = [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
    ]
    const segs = measureSharedGutterSegments({
      cells,
      rowFractions: [1, 1],
      colFractions: [1, 1],
      gridWidth: grid,
      gridHeight: grid,
      gap,
    })
    const cols = segs.filter((s) => s.axis === 'col')
    const rows = segs.filter((s) => s.axis === 'row')
    expect(cols).toHaveLength(1)
    expect(rows).toHaveLength(1)
    expect(cols[0]!.index).toBe(0)
    expect(rows[0]!.index).toBe(0)
    expect(cols[0]!.start).toBeCloseTo(0)
    expect(cols[0]!.length).toBeCloseTo(grid)
    expect(rows[0]!.start).toBeCloseTo(0)
    expect(rows[0]!.length).toBeCloseTo(grid)
    expect(cols[0]!.center).toBeCloseTo(105) // 100 + gap/2
    expect(rows[0]!.center).toBeCloseTo(105)
  })

  it('keeps row gutter only on shared edge for left-stack irregular layout', () => {
    const cells: LayoutCell[] = [
      { row: 0, col: 0, rowSpan: 2, colSpan: 1 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
    ]
    const segs = measureSharedGutterSegments({
      cells,
      rowFractions: [1, 1],
      colFractions: [1, 1],
      gridWidth: grid,
      gridHeight: grid,
      gap,
    })
    const rowGutters = segs.filter((s) => s.axis === 'row' && s.index === 0)
    expect(rowGutters).toHaveLength(1)
    // Right column only — no orphan full-width / left-column ghost.
    expect(rowGutters[0]!.start).toBeCloseTo(110)
    expect(rowGutters[0]!.length).toBeCloseTo(100)
    expect(rowGutters.some((g) => g.start < 50)).toBe(false)

    const colGutters = segs.filter((s) => s.axis === 'col' && s.index === 0)
    expect(colGutters).toHaveLength(1)
    expect(colGutters[0]!.start).toBeCloseTo(0)
    expect(colGutters[0]!.length).toBeCloseTo(grid)
  })

  it('returns no gutters for a single cell', () => {
    const segs = measureSharedGutterSegments({
      cells: [{ row: 0, col: 0, rowSpan: 1, colSpan: 1 }],
      rowFractions: [1],
      colFractions: [1],
      gridWidth: 100,
      gridHeight: 100,
      gap: 8,
    })
    expect(segs).toEqual([])
  })

  it('returns empty when grid box is zero', () => {
    expect(
      measureSharedGutterSegments({
        cells: [
          { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
          { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
        ],
        rowFractions: [1],
        colFractions: [1, 1],
        gridWidth: 0,
        gridHeight: 100,
        gap: 8,
      }),
    ).toEqual([])
  })
})
