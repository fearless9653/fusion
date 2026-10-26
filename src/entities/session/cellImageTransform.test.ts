import { describe, expect, it } from 'vitest'
import {
  cellTransformsEqual,
  isIdentityCellTransform,
  normalizeCellRotation,
  resolveCellTransform,
  rotateCellCw,
  toCanonicalCellTransform,
} from './cellImageTransform'

describe('normalizeCellRotation', () => {
  it('snaps to quarter turns', () => {
    expect(normalizeCellRotation(0)).toBe(0)
    expect(normalizeCellRotation(90)).toBe(90)
    expect(normalizeCellRotation(180)).toBe(180)
    expect(normalizeCellRotation(270)).toBe(270)
    expect(normalizeCellRotation(360)).toBe(0)
    expect(normalizeCellRotation(-90)).toBe(270)
    expect(normalizeCellRotation(95)).toBe(90)
    expect(normalizeCellRotation(undefined)).toBe(0)
    expect(normalizeCellRotation(Number.NaN)).toBe(0)
  })
})

describe('rotateCellCw', () => {
  it('advances 90 deg clockwise', () => {
    expect(rotateCellCw(0)).toBe(90)
    expect(rotateCellCw(90)).toBe(180)
    expect(rotateCellCw(180)).toBe(270)
    expect(rotateCellCw(270)).toBe(0)
  })
})

describe('resolveCellTransform', () => {
  it('defaults missing fields', () => {
    expect(resolveCellTransform(null)).toEqual({ rotation: 0, flipX: false, flipY: false })
    expect(resolveCellTransform({ flipX: true })).toEqual({
      rotation: 0,
      flipX: true,
      flipY: false,
    })
  })
})

describe('isIdentityCellTransform', () => {
  it('is true only for zero rotation and no flips', () => {
    expect(isIdentityCellTransform(null)).toBe(true)
    expect(isIdentityCellTransform({ rotation: 0 })).toBe(true)
    expect(isIdentityCellTransform({ rotation: 90 })).toBe(false)
    expect(isIdentityCellTransform({ flipY: true })).toBe(false)
  })
})

describe('toCanonicalCellTransform', () => {
  it('keeps the 8 rotation×flipX forms and clears flipY', () => {
    expect(toCanonicalCellTransform({ rotation: 90, flipX: true })).toEqual({
      rotation: 90,
      flipX: true,
      flipY: false,
    })
    expect(toCanonicalCellTransform({ rotation: 0, flipY: true })).toEqual({
      rotation: 180,
      flipX: true,
      flipY: false,
    })
    expect(toCanonicalCellTransform({ rotation: 0, flipX: true, flipY: true })).toEqual({
      rotation: 180,
      flipX: false,
      flipY: false,
    })
  })

  it('maps all 16 raw combos onto at most 8 canonical orientations', () => {
    const seen = new Set<string>()
    for (const rotation of [0, 90, 180, 270] as const) {
      for (const flipX of [false, true]) {
        for (const flipY of [false, true]) {
          const c = toCanonicalCellTransform({ rotation, flipX, flipY })
          expect(c.flipY).toBe(false)
          seen.add(`${c.rotation}:${c.flipX}`)
        }
      }
    }
    expect(seen.size).toBe(8)
  })

  it('treats double-flip as identity after canonicalization', () => {
    expect(isIdentityCellTransform({ rotation: 0, flipX: true, flipY: true })).toBe(false)
    expect(isIdentityCellTransform({ rotation: 180, flipX: true, flipY: true })).toBe(true)
  })
})

describe('cellTransformsEqual', () => {
  it('compares resolved fields', () => {
    expect(cellTransformsEqual({ rotation: 90 }, { rotation: 90, flipX: false })).toBe(true)
    expect(cellTransformsEqual({ flipX: true }, { flipY: true })).toBe(false)
  })
})
