import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PRINT_DPI,
  PORTRAIT_PRINT_SIZE_PRESETS,
  ASPECT_RATIO_PRESETS,
  PRINT_SIZE_PRESETS,
  QUALITY_MAX_EDGE,
  computeExportSize,
  getPairedPrintSizeId,
  getPrintSizePreset,
  isSamePrintSizePair,
  printSizePairBase,
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

  it('does not emit OOM-scale canvas when reduced components force k0 mega fallback', () => {
    // Coprime-ish huge sides: without the soft guard, k=k0 yields ~99980×99990.
    const ratio = { width: 9998, height: 9999 }
    const maxEdge = QUALITY_MAX_EDGE['high-jpg']
    const size = computeExportSize({
      aspectRatio: ratio,
      quality: 'high-jpg',
    })
    expect(size.width).toBeLessThanOrEqual(maxEdge)
    expect(size.height).toBeLessThanOrEqual(maxEdge)
    expect(size.width).toBeGreaterThan(0)
    expect(size.height).toBeGreaterThan(0)
    // Must stay far below the old mega fallback (~1e5 per side).
    expect(size.width).toBeLessThan(maxEdge * 2)
    expect(size.height).toBeLessThan(maxEdge * 2)
  })
})

describe('print size portrait UI helpers', () => {
  it('keeps all presets for export while UI list is portrait-only', () => {
    expect(PRINT_SIZE_PRESETS.map((p) => p.id)).toEqual([
      '3R',
      '3R-L',
      '4R',
      '4R-L',
      '5R',
      '5R-L',
      '6R',
      '6R-L',
      '8R',
      '8R-L',
      'S8R',
      'S8R-L',
      'A4',
      'A4-L',
      'A3',
      'A3-L',
    ])
    expect(PORTRAIT_PRINT_SIZE_PRESETS.map((p) => p.id)).toEqual([
      '3R',
      '4R',
      '5R',
      '6R',
      '8R',
      'S8R',
      'A4',
      'A3',
    ])
  })

  it('remaps print ids within a portrait/landscape pair', () => {
    expect(getPairedPrintSizeId('4R')).toBe('4R-L')
    expect(getPairedPrintSizeId('4R-L')).toBe('4R')
    expect(getPairedPrintSizeId('A4')).toBe('A4-L')
    expect(getPairedPrintSizeId('A4-L')).toBe('A4')
    expect(getPairedPrintSizeId('S8R')).toBe('S8R-L')
    expect(getPairedPrintSizeId('S8R-L')).toBe('S8R')
    expect(getPairedPrintSizeId('3R')).toBe('3R-L')
    expect(getPairedPrintSizeId('A3-L')).toBe('A3')
    expect(getPairedPrintSizeId('unknown')).toBeUndefined()
  })

  it('matches highlight by pair base even when current id is landscape', () => {
    expect(printSizePairBase('5R-L')).toBe('5R')
    expect(printSizePairBase('S8R-L')).toBe('S8R')
    expect(printSizePairBase('S8R')).toBe('S8R')
    expect(isSamePrintSizePair('5R-L', '5R')).toBe(true)
    expect(isSamePrintSizePair('S8R-L', 'S8R')).toBe(true)
    expect(isSamePrintSizePair('5R', '8R')).toBe(false)
  })
})

describe('aspect ratio presets', () => {
  it('lists landscape-oriented common ratios including 3:2', () => {
    expect(ASPECT_RATIO_PRESETS.map((p) => p.id)).toEqual([
      '1:1',
      '3:2',
      '4:3',
      '5:4',
      '16:9',
      '16:10',
    ])
    expect(ASPECT_RATIO_PRESETS.find((p) => p.id === '3:2')?.ratio).toEqual({
      width: 3,
      height: 2,
    })
  })
})
