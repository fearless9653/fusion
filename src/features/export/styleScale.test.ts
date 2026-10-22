import { describe, expect, it } from 'vitest'
import { scaleStyleLengths, stylePxScale } from './styleScale'

describe('stylePxScale', () => {
  it('is exportWidth / previewWidth', () => {
    expect(stylePxScale(4000, 800)).toBeCloseTo(5)
    expect(stylePxScale(2000, 500)).toBeCloseTo(4)
  })

  it('falls back to 1 when preview is missing/zero', () => {
    expect(stylePxScale(4000, 0)).toBe(1)
    expect(stylePxScale(0, 800)).toBe(1)
  })
})

describe('scaleStyleLengths', () => {
  it('scales spacing, radius, and per-side borders', () => {
    const out = scaleStyleLengths(
      { spacing: 10, radius: 20, borders: { top: 10, right: 10, bottom: 10, left: 10 } },
      4,
    )
    expect(out.spacing).toBe(40)
    expect(out.radius).toBe(80)
    expect(out.borders).toEqual({ top: 40, right: 40, bottom: 40, left: 40 })
  })
})
