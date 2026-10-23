import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PRINT_DPI,
  QUALITY_MAX_EDGE,
  computeExportSize,
  getPrintSizePreset,
} from './computeExportSize'

function expectExactAspectMod10(
  size: { width: number; height: number },
  ratio: { width: number; height: number },
): void {
  expect(size.width % 10).toBe(0)
  expect(size.height % 10).toBe(0)
  expect(size.width * ratio.height).toBe(size.height * ratio.width)
}

describe('computeExportSize', () => {
  it('fits square ratio to quality max edge', () => {
    const ratio = { width: 1, height: 1 }
    const size = computeExportSize({
      aspectRatio: ratio,
      quality: 'high-jpg',
    })
    expect(size).toEqual({ width: 4000, height: 4000 })
    expectExactAspectMod10(size, ratio)
  })

  it('uses medium-jpg cap with exact aspect and mod-10 dims', () => {
    const ratio = { width: 16, height: 9 }
    const size = computeExportSize({
      aspectRatio: ratio,
      quality: 'medium-jpg',
    })
    // 16k<=2000 → k=120 (step 10) → 1920×1080, not 2000×1125
    expect(size).toEqual({ width: 1920, height: 1080 })
    expect(size.width).toBeLessThanOrEqual(QUALITY_MAX_EDGE['medium-jpg'])
    expectExactAspectMod10(size, ratio)
  })

  it('prefers exact 3:2 over filling quality max edge', () => {
    const ratio = { width: 3, height: 2 }
    const size = computeExportSize({
      aspectRatio: ratio,
      quality: 'high-jpg',
    })
    // Not 4000×2667 — exact ratio + both %10: 3990×2660
    expect(size).toEqual({ width: 3990, height: 2660 })
    expectExactAspectMod10(size, ratio)
  })

  it('keeps 16:9 at full max edge when already exact and mod-10', () => {
    const ratio = { width: 16, height: 9 }
    const size = computeExportSize({
      aspectRatio: ratio,
      quality: 'high-jpg',
    })
    expect(size).toEqual({ width: 4000, height: 2250 })
    expectExactAspectMod10(size, ratio)
  })

  it('fits 4:3 at high-jpg max edge', () => {
    const ratio = { width: 4, height: 3 }
    const size = computeExportSize({
      aspectRatio: ratio,
      quality: 'high-jpg',
    })
    expect(size).toEqual({ width: 4000, height: 3000 })
    expectExactAspectMod10(size, ratio)
  })

  it('computes A4 portrait as largest exact mod-10 size in raw print box', () => {
    const a4 = getPrintSizePreset('A4')!
    const ratio = { width: 210, height: 297 }
    const rawW = Math.round((210 / 25.4) * DEFAULT_PRINT_DPI)
    const rawH = Math.round((297 / 25.4) * DEFAULT_PRINT_DPI)
    const size = computeExportSize({
      aspectRatio: ratio,
      printSize: a4,
      quality: 'high-jpg',
      dpi: DEFAULT_PRINT_DPI,
    })
    // raw ≈ 2480×3508; reduced 70:99, k0=10 → k=30 → 2100×2970
    expect(size).toEqual({ width: 2100, height: 2970 })
    expect(size.width).toBeLessThanOrEqual(rawW)
    expect(size.height).toBeLessThanOrEqual(rawH)
    expectExactAspectMod10(size, ratio)
  })

  it('honors explicit maxEdge override', () => {
    const ratio = { width: 2, height: 1 }
    const size = computeExportSize({
      aspectRatio: ratio,
      quality: 'png',
      maxEdge: 1000,
    })
    expect(size).toEqual({ width: 1000, height: 500 })
    expectExactAspectMod10(size, ratio)
  })
})
