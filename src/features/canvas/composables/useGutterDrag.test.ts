import { describe, expect, it } from 'vitest'
import { GUTTER_HIT_MIN_PX, gutterHitPx } from './useGutterDrag'

describe('gutterHitPx', () => {
  it('uses a touch-friendly minimum when gap is 0', () => {
    expect(gutterHitPx(0)).toBe(GUTTER_HIT_MIN_PX)
    expect(GUTTER_HIT_MIN_PX).toBeGreaterThanOrEqual(24)
    expect(GUTTER_HIT_MIN_PX).toBeLessThanOrEqual(44)
  })

  it('follows gap when gap is wider than the minimum', () => {
    expect(gutterHitPx(40)).toBe(40)
  })

  it('clamps negative gap to the minimum', () => {
    expect(gutterHitPx(-4)).toBe(GUTTER_HIT_MIN_PX)
  })
})
