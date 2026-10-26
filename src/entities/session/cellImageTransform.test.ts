import { describe, expect, it } from 'vitest'
import {
  cellTransformsEqual,
  flipCellHorizontalScreen,
  flipCellVerticalScreen,
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

describe('flipCellHorizontalScreen / flipCellVerticalScreen', () => {
  it('at 0° toggles local flipX / flipY', () => {
    expect(flipCellHorizontalScreen({ rotation: 0 })).toEqual({
      rotation: 0,
      flipX: true,
      flipY: false,
    })
    expect(flipCellVerticalScreen({ rotation: 0 })).toEqual({
      rotation: 0,
      flipX: false,
      flipY: true,
    })
  })

  it('after rotate 90° CW, screen flipH maps to local flipY (not flipX)', () => {
    const afterRotate = { rotation: 90 as const, flipX: false, flipY: false }
    const flipped = flipCellHorizontalScreen(afterRotate)
    expect(flipped).toEqual({ rotation: 90, flipX: false, flipY: true })
    // Canonical bake form: flipY@90 ≡ flipX@270
    expect(toCanonicalCellTransform(flipped)).toEqual({
      rotation: 270,
      flipX: true,
      flipY: false,
    })
    // Naive local flipX would be wrong (screen vertical after R90)
    expect(flipped.flipX).toBe(false)
  })

  it('after rotate 90° CW, screen flipV maps to local flipX', () => {
    expect(flipCellVerticalScreen({ rotation: 90 })).toEqual({
      rotation: 90,
      flipX: true,
      flipY: false,
    })
  })

  it('after rotate 270°, screen axes remain swapped', () => {
    expect(flipCellHorizontalScreen({ rotation: 270 })).toEqual({
      rotation: 270,
      flipX: false,
      flipY: true,
    })
    expect(flipCellVerticalScreen({ rotation: 270 })).toEqual({
      rotation: 270,
      flipX: true,
      flipY: false,
    })
  })

  it('after rotate 180°, screen flipH still toggles local flipX', () => {
    expect(flipCellHorizontalScreen({ rotation: 180 })).toEqual({
      rotation: 180,
      flipX: true,
      flipY: false,
    })
  })

  it('rotate90 then flipH twice returns to rotate90 (canonical)', () => {
    let tf = { rotation: 0 as const, flipX: false, flipY: false }
    tf = { ...tf, rotation: rotateCellCw(tf.rotation) }
    expect(tf.rotation).toBe(90)
    tf = toCanonicalCellTransform(flipCellHorizontalScreen(tf))
    expect(tf).toEqual({ rotation: 270, flipX: true, flipY: false })
    tf = toCanonicalCellTransform(flipCellHorizontalScreen(tf))
    expect(tf).toEqual({ rotation: 90, flipX: false, flipY: false })
  })

  it('rotate90 then flipH then rotate90 equals flipX (canonical)', () => {
    let tf = toCanonicalCellTransform({ rotation: 0 })
    tf = toCanonicalCellTransform({ ...tf, rotation: rotateCellCw(tf.rotation) })
    tf = toCanonicalCellTransform(flipCellHorizontalScreen(tf))
    tf = toCanonicalCellTransform({ ...tf, rotation: rotateCellCw(tf.rotation) })
    expect(tf).toEqual({ rotation: 0, flipX: true, flipY: false })
  })

  it('screen H/V after each quarter-turn maps through bake flip-then-rotate', () => {
    for (const rotation of [0, 90, 180, 270] as const) {
      const base = toCanonicalCellTransform({ rotation })
      const h = toCanonicalCellTransform(flipCellHorizontalScreen(base))
      const v = toCanonicalCellTransform(flipCellVerticalScreen(base))
      // Double screen H returns to base
      expect(toCanonicalCellTransform(flipCellHorizontalScreen(h))).toEqual(base)
      // Double screen V returns to base
      expect(toCanonicalCellTransform(flipCellVerticalScreen(v))).toEqual(base)
      // H then V equals V then H
      const hv = toCanonicalCellTransform(flipCellVerticalScreen(h))
      const vh = toCanonicalCellTransform(flipCellHorizontalScreen(v))
      expect(hv).toEqual(vh)
    }
  })

  it('rotate90 then flipH then flipV equals rotate 270 (canonical)', () => {
    let tf = toCanonicalCellTransform({ rotation: 90 })
    tf = toCanonicalCellTransform(flipCellHorizontalScreen(tf))
    tf = toCanonicalCellTransform(flipCellVerticalScreen(tf))
    expect(tf).toEqual({ rotation: 270, flipX: false, flipY: false })
  })
})

describe('cellTransformsEqual', () => {
  it('compares resolved fields', () => {
    expect(cellTransformsEqual({ rotation: 90 }, { rotation: 90, flipX: false })).toBe(true)
    expect(cellTransformsEqual({ flipX: true }, { flipY: true })).toBe(false)
  })
})
