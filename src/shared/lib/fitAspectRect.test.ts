import { describe, expect, it } from 'vitest'
import { fitAspectRect } from './fitAspectRect'

describe('fitAspectRect', () => {
  it('returns zeros for non-positive inputs', () => {
    expect(fitAspectRect(0, 100, 1, 1)).toEqual({ width: 0, height: 0 })
    expect(fitAspectRect(100, 100, 0, 1)).toEqual({ width: 0, height: 0 })
  })

  it('letterboxes a tall ratio inside a wide container (height-constrained)', () => {
    // 200×100 container, 1:1 → 100×100
    expect(fitAspectRect(200, 100, 1, 1)).toEqual({ width: 100, height: 100 })
  })

  it('pillarboxes a wide ratio inside a tall container (width-constrained)', () => {
    // 100×200 container, 1:1 → 100×100
    expect(fitAspectRect(100, 200, 1, 1)).toEqual({ width: 100, height: 100 })
  })

  it('preserves 16:9 inside a square stage', () => {
    const r = fitAspectRect(400, 400, 16, 9)
    expect(r.width).toBeCloseTo(400)
    expect(r.height).toBeCloseTo(400 * (9 / 16))
  })

  it('preserves 9:16 inside a square stage', () => {
    const r = fitAspectRect(400, 400, 9, 16)
    expect(r.height).toBeCloseTo(400)
    expect(r.width).toBeCloseTo(400 * (9 / 16))
  })

  it('fills exactly when ratios match', () => {
    expect(fitAspectRect(320, 180, 16, 9)).toEqual({ width: 320, height: 180 })
  })
})
