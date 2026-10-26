import { describe, expect, it, vi } from 'vitest'
import { getTemplate } from '@/entities/layout'
import { DEFAULT_STYLE, createEmptyCellImages } from '@/entities/session'
import {
  coverDrawRect,
  drawCoverImage,
  exportFilename,
  jpegQualityFor,
  renderCollage,
} from './renderCollage'

function mockCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    rect: vi.fn(),
    moveTo: vi.fn(),
    arcTo: vi.fn(),
    clip: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn((s: string) => ({
      width: String(s).length * 8,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 3,
    })),

    drawImage: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    fillStyle: '',
    globalAlpha: 1,
    font: '',
    textAlign: 'center',
    textBaseline: 'middle',
  }
}

describe('drawCoverImage', () => {
  it('does not throw for zero-size targets', () => {
    const ctx = mockCtx() as unknown as CanvasRenderingContext2D
    const src = document.createElement('canvas')
    expect(() => drawCoverImage(ctx, src, 4, 4, 0, 0, 0, 10, 50, 50)).not.toThrow()
    expect(ctx.drawImage).not.toHaveBeenCalled()
  })

  it('clips and draws for a normal rect', () => {
    const ctx = mockCtx() as unknown as CanvasRenderingContext2D
    const src = document.createElement('canvas')
    drawCoverImage(ctx, src, 100, 50, 0, 0, 200, 200, 50, 50)
    expect(ctx.clip).toHaveBeenCalled()
    expect(ctx.drawImage).toHaveBeenCalled()
  })
})

describe('renderCollage', () => {
  it('renders a canvas matching export size for a 2x2 layout', () => {
    const ctx = mockCtx()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    )
    const layout = getTemplate('tpl_grid_2x2')!
    const style = {
      ...structuredClone(DEFAULT_STYLE),
      aspectRatio: { width: 1, height: 1 },
      downloadQuality: 'medium-jpg' as const,
      spacing: 4,
      borders: { top: 10, right: 10, bottom: 10, left: 10 },
      watermark: {
        enabled: true,
        text: 'test',
        fontSize: 16,
        opacity: 0.2,
        rotation: -30,
        density: 2,
      },
    }
    const result = renderCollage({
      layout,
      style,
      cellImages: createEmptyCellImages(4),
      images: new Map(),
    })
    expect(result.width).toBe(2000)
    expect(result.height).toBe(2000)
    expect(result.extension).toBe('jpg')
    expect(result.canvas.width).toBe(2000)
    expect(ctx.fillRect).toHaveBeenCalled()
    vi.restoreAllMocks()
  })
})

describe('export helpers', () => {
  it('picks jpeg quality and filename extension', () => {
    expect(jpegQualityFor({ ...DEFAULT_STYLE, downloadQuality: 'png' })).toBeUndefined()
    expect(jpegQualityFor({ ...DEFAULT_STYLE, downloadQuality: 'high-jpg' })).toBe(0.92)
    expect(exportFilename('png')).toMatch(/^fusion-\d{14}-[0-9a-f]{8}\.png$/i)
  })
})

describe('renderCollage track fractions', () => {
  it('uses unequal col fractions when provided', () => {
    const ctx = mockCtx()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    )
    const layout = getTemplate('tpl_grid_2x2')!
    const style = {
      ...structuredClone(DEFAULT_STYLE),
      aspectRatio: { width: 1, height: 1 },
      downloadQuality: 'medium-jpg' as const,
      spacing: 0,
      radius: 0,
      borders: { top: 0, right: 0, bottom: 0, left: 0 },
    }
    renderCollage({
      layout,
      style,
      cellImages: createEmptyCellImages(4),
      images: new Map(),
      rowFractions: [1, 1],
      colFractions: [1, 3],
    })
    // First cell (0,0) should be clipped to a quarter-width rect on a 2000px canvas
    // clip via roundRectPath → rect(0,0,500,1000) for equal rows / 1:3 cols
    expect(ctx.rect).toHaveBeenCalledWith(0, 0, 500, 1000)
    vi.restoreAllMocks()
  })
})

describe('coverDrawRect / scale', () => {
  it('doubles draw size when imageScale is 2 at center', () => {
    const base = coverDrawRect(100, 100, 100, 100, 50, 50, 1)
    const zoomed = coverDrawRect(100, 100, 100, 100, 50, 50, 2)
    expect(base.drawW).toBeCloseTo(100)
    expect(zoomed.drawW).toBeCloseTo(200)
    expect(zoomed.ox).toBeCloseTo(-50)
  })
})

describe('renderCollage style scale', () => {
  it('scales spacing with previewSize (exportWidth / previewWidth)', () => {
    const ctx = mockCtx()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    )
    const layout = getTemplate('tpl_split_h')!
    const style = {
      ...structuredClone(DEFAULT_STYLE),
      aspectRatio: { width: 1, height: 1 },
      downloadQuality: 'medium-jpg' as const,
      spacing: 10,
      radius: 0,
      borders: { top: 0, right: 0, bottom: 0, left: 0 },
    }
    // medium-jpg square → 2000×2000; preview 500 → scale 4 → gap 40
    // equal cols: usable = 2000 - 40 = 1960; each cell 980
    renderCollage({
      layout,
      style,
      cellImages: createEmptyCellImages(2),
      images: new Map(),
      previewSize: { width: 500, height: 500 },
    })
    // Second cell starts at x = 980 + 40 = 1020
    expect(ctx.rect).toHaveBeenCalledWith(0, 0, 980, 2000)
    expect(ctx.rect).toHaveBeenCalledWith(1020, 0, 980, 2000)
    vi.restoreAllMocks()
  })
})
