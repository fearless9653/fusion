import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PRINT_DPI,
  QUALITY_MAX_EDGE,
  computeExportSize,
  getPrintSizePreset,
} from './computeExportSize'

describe('computeExportSize', () => {
  it('fits square ratio to quality max edge', () => {
    const size = computeExportSize({
      aspectRatio: { width: 1, height: 1 },
      quality: 'high-jpg',
    })
    expect(size).toEqual({ width: 4000, height: 4000 })
  })

  it('uses medium-jpg cap', () => {
    const size = computeExportSize({
      aspectRatio: { width: 16, height: 9 },
      quality: 'medium-jpg',
    })
    expect(size.width).toBe(QUALITY_MAX_EDGE['medium-jpg'])
    expect(size.height).toBe(Math.round((2000 * 9) / 16))
  })

  it('computes A4 portrait at default DPI', () => {
    const a4 = getPrintSizePreset('A4')!
    const size = computeExportSize({
      aspectRatio: { width: 210, height: 297 },
      printSize: a4,
      quality: 'high-jpg',
      dpi: DEFAULT_PRINT_DPI,
    })
    expect(size.width).toBe(Math.round((210 / 25.4) * 300))
    expect(size.height).toBe(Math.round((297 / 25.4) * 300))
  })

  it('honors explicit maxEdge override', () => {
    const size = computeExportSize({
      aspectRatio: { width: 2, height: 1 },
      quality: 'png',
      maxEdge: 1000,
    })
    expect(size).toEqual({ width: 1000, height: 500 })
  })
})
