import { describe, expect, it } from 'vitest'
import {
  cellRectFromFractions,
  fractionsToCssTemplate,
  normalizeFractions,
  redistributeAdjacent,
  trackPixelSizes,
} from './trackFractions'

describe('normalizeFractions', () => {
  it('fills with 1 when existing is missing', () => {
    expect(normalizeFractions(3)).toEqual([1, 1, 1])
    expect(normalizeFractions(0)).toEqual([])
  })

  it('pads / truncates and replaces non-positive values', () => {
    expect(normalizeFractions(4, [2, 0, -1])).toEqual([2, 1, 1, 1])
    expect(normalizeFractions(2, [3, 4, 5])).toEqual([3, 4])
  })
})

describe('redistributeAdjacent', () => {
  it('moves weight from right/bottom neighbor on positive delta', () => {
    expect(redistributeAdjacent([1, 1, 1], 0, 0.25)).toEqual([1.25, 0.75, 1])
  })

  it('clamps so neither side drops below minFraction', () => {
    const grow = redistributeAdjacent([1, 1], 0, 10, 0.15)
    expect(grow[0]).toBeCloseTo(1.85)
    expect(grow[1]).toBeCloseTo(0.15)
    const shrink = redistributeAdjacent([1, 1], 0, -10, 0.15)
    expect(shrink[0]).toBeCloseTo(0.15)
    expect(shrink[1]).toBeCloseTo(1.85)
  })

  it('no-ops for out-of-range gutter or zero delta', () => {
    expect(redistributeAdjacent([1, 1], 1, 0.5)).toEqual([1, 1])
    expect(redistributeAdjacent([1, 1], 0, 0)).toEqual([1, 1])
  })
})

describe('trackPixelSizes + cellRectFromFractions', () => {
  it('splits usable axis by fraction weight', () => {
    expect(trackPixelSizes([1, 1], 100)).toEqual([50, 50])
    expect(trackPixelSizes([1, 3], 100)).toEqual([25, 75])
  })

  it('lays out equal 2x2 cells with gap (square when canvas square)', () => {
    const gap = 10
    const inner = 210 // 2*100 + 10
    const a = cellRectFromFractions({
      row: 0,
      col: 0,
      rowSpan: 1,
      colSpan: 1,
      rowFractions: [1, 1],
      colFractions: [1, 1],
      innerWidth: inner,
      innerHeight: inner,
      gap,
    })
    const b = cellRectFromFractions({
      row: 0,
      col: 1,
      rowSpan: 1,
      colSpan: 1,
      rowFractions: [1, 1],
      colFractions: [1, 1],
      innerWidth: inner,
      innerHeight: inner,
      gap,
    })
    expect(a).toEqual({ x: 0, y: 0, w: 100, h: 100 })
    expect(b).toEqual({ x: 110, y: 0, w: 100, h: 100 })
    expect(a.w).toBe(a.h)
  })

  it('includes gaps inside spanned cells', () => {
    const r = cellRectFromFractions({
      row: 0,
      col: 0,
      rowSpan: 1,
      colSpan: 2,
      rowFractions: [1],
      colFractions: [1, 1],
      innerWidth: 210,
      innerHeight: 100,
      gap: 10,
    })
    expect(r).toEqual({ x: 0, y: 0, w: 210, h: 100 })
  })
})

describe('fractionsToCssTemplate', () => {
  it('joins Nfr tokens', () => {
    expect(fractionsToCssTemplate([1, 2, 1])).toBe('1fr 2fr 1fr')
  })
})
