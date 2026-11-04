import { describe, expect, it } from 'vitest'
import { WATERMARK_FONT_FAMILY, watermarkCanvasFont } from './watermarkFont'

describe('watermarkFont', () => {
  it('builds canvas font with shared family', () => {
    expect(watermarkCanvasFont(20)).toBe(`20px ${WATERMARK_FONT_FAMILY}`)
  })

  it('clamps fontSize to at least 8', () => {
    expect(watermarkCanvasFont(0)).toBe(`8px ${WATERMARK_FONT_FAMILY}`)
  })
})
