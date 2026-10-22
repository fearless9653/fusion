import { describe, expect, it } from 'vitest'
import {
  estimateTextSize,
  isTextAabbInside,
  resolveWatermarkMode,
  resolveWatermarkPosition,
  rotatedTextHalfExtents,
  watermarkSingleAnchor,
  watermarkTileOffsets,
  watermarkTileSteps,
} from './watermarkLayout'

describe('watermarkTileSteps', () => {
  it('shrinks as density rises', () => {
    const m = estimateTextSize('hello', 20)
    const sparse = watermarkTileSteps(20, 1, m)
    const dense = watermarkTileSteps(20, 4, m)
    expect(sparse.stepX).toBeGreaterThan(dense.stepX)
    expect(sparse.stepY).toBeGreaterThan(dense.stepY)
  })

  it('long string yields stepX at least ~1.2× text width (sparse ≥ 2×)', () => {
    const long = '这是一段很长的水印文字用于测试重叠'
    const m = estimateTextSize(long, 24)
    const sparse = watermarkTileSteps(24, 1, m)
    const dense = watermarkTileSteps(24, 4, m)
    expect(sparse.stepX).toBeGreaterThanOrEqual(m.width * 2)
    expect(dense.stepX).toBeGreaterThanOrEqual(m.width * 1.2)
  })
})

describe('watermarkSingleAnchor', () => {
  it('keeps long bottom-right text AABB inside the canvas', () => {
    // Canvas large enough that AABB can fit; naive fontSize inset would still clip.
    const canvasW = 640
    const canvasH = 480
    const metrics = estimateTextSize('LongWatermarkTextLabel!', 28)
    const rotation = -30
    const anchor = watermarkSingleAnchor('bottom-right', canvasW, canvasH, metrics, rotation)
    const { hw, hh } = rotatedTextHalfExtents(metrics.width, metrics.height, rotation)
    expect(hw).toBeGreaterThan(28) // would clip with tiny inset
    expect(isTextAabbInside(anchor.x, anchor.y, hw, hh, canvasW, canvasH)).toBe(true)
    expect(anchor.x + hw).toBeLessThanOrEqual(canvasW + 0.5)
    expect(anchor.y + hh).toBeLessThanOrEqual(canvasH + 0.5)
    // Farther in than a naive fontSize-only inset corner.
    expect(anchor.x).toBeLessThan(canvasW - 28)
  })

  it('centers when position is center', () => {
    const m = estimateTextSize('x', 20)
    const a = watermarkSingleAnchor('center', 200, 100, m, 0)
    expect(a.x).toBeCloseTo(100)
    expect(a.y).toBeCloseTo(50)
  })
})

describe('watermarkTileOffsets', () => {
  it('returns a grid covering the diagonal span', () => {
    const m = estimateTextSize('WM', 20)
    const pts = watermarkTileOffsets(400, 400, 20, 2, m)
    expect(pts.length).toBeGreaterThan(4)
    expect(pts.some((p) => p.x < 0 && p.y < 0)).toBe(true)
    expect(pts.some((p) => p.x > 0 && p.y > 0)).toBe(true)
  })
})

describe('resolveWatermark*', () => {
  it('defaults missing mode/position for backward compat', () => {
    expect(
      resolveWatermarkMode({
        enabled: true,
        text: 'x',
        fontSize: 12,
        opacity: 1,
        rotation: 0,
        density: 1,
      } as never),
    ).toBe('tile')
    expect(
      resolveWatermarkPosition({
        enabled: true,
        text: 'x',
        fontSize: 12,
        opacity: 1,
        rotation: 0,
        density: 1,
      } as never),
    ).toBe('center')
  })
})
