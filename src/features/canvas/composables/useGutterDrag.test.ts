import { describe, expect, it } from 'vitest'
import { GUTTER_HIT_MIN_PX, gutterHitPx } from './useGutterDrag'

describe('gutterHitPx', () => {
  it('uses the legacy 8px minimum when gap is 0', () => {
    expect(GUTTER_HIT_MIN_PX).toBe(8)
    expect(gutterHitPx(0)).toBe(8)
  })

  it('follows gap when gap is wider than the minimum', () => {
    expect(gutterHitPx(40)).toBe(40)
  })

  it('clamps negative gap to the minimum', () => {
    expect(gutterHitPx(-4)).toBe(GUTTER_HIT_MIN_PX)
  })
})
