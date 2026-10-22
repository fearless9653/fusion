import { describe, expect, it, vi } from 'vitest'
import { drawWatermark } from './drawWatermark'
import type { WatermarkStyle } from '@/entities/session'
import { rotatedTextHalfExtents, watermarkSingleAnchor } from './watermarkLayout'

function base(partial: Partial<WatermarkStyle> = {}): WatermarkStyle {
  return {
    enabled: true,
    text: 'WM',
    fontSize: 18,
    opacity: 0.3,
    rotation: -30,
    density: 3,
    mode: 'tile',
    position: 'center',
    ...partial,
  }
}

function mockCtx(measureWidth = 40) {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn((t: string) => ({
      width: typeof t === 'string' ? Math.max(measureWidth, t.length * 10) : measureWidth,
      actualBoundingBoxAscent: 14,
      actualBoundingBoxDescent: 4,
    })),
    globalAlpha: 1,
    fillStyle: '',
    font: '',
    textAlign: 'center' as CanvasTextAlign,
    textBaseline: 'middle' as CanvasTextBaseline,
  }
}

describe('drawWatermark', () => {
  it('no-ops when disabled or empty', () => {
    const ctx = mockCtx()
    drawWatermark(ctx as unknown as CanvasRenderingContext2D, 100, 100, base({ enabled: false }))
    expect(ctx.fillText).not.toHaveBeenCalled()

    drawWatermark(ctx as unknown as CanvasRenderingContext2D, 100, 100, base({ text: '   ' }))
    expect(ctx.fillText).not.toHaveBeenCalled()
  })

  it('draws a tile grid when mode is tile', () => {
    const ctx = mockCtx()
    drawWatermark(ctx as unknown as CanvasRenderingContext2D, 400, 400, base({ mode: 'tile' }))
    expect(ctx.save).toHaveBeenCalled()
    expect(ctx.fillText.mock.calls.length).toBeGreaterThan(1)
    expect(ctx.translate).toHaveBeenCalledWith(200, 200)
    expect(ctx.restore).toHaveBeenCalled()
  })

  it('single bottom-right long text stays inside via measured AABB', () => {
    const text = 'LongWatermarkTextLabel!'
    const fontSize = 28
    const canvasW = 640
    const canvasH = 480
    const rotation = -30
    const measuredW = text.length * 12
    const ctx = mockCtx(measuredW)
    drawWatermark(
      ctx as unknown as CanvasRenderingContext2D,
      canvasW,
      canvasH,
      base({ mode: 'single', position: 'bottom-right', text, fontSize, rotation }),
    )
    expect(ctx.fillText).toHaveBeenCalledTimes(1)
    const metrics = {
      width: Math.max(fontSize * 0.5, measuredW),
      height: Math.max(fontSize, 14 + 4),
    }
    const expected = watermarkSingleAnchor('bottom-right', canvasW, canvasH, metrics, rotation)
    expect(ctx.translate).toHaveBeenCalledWith(expected.x, expected.y)
    const { hw, hh } = rotatedTextHalfExtents(metrics.width, metrics.height, rotation)
    expect(expected.x + hw).toBeLessThanOrEqual(canvasW + 0.5)
    expect(expected.y + hh).toBeLessThanOrEqual(canvasH + 0.5)
  })
})
