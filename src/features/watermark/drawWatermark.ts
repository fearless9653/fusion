import type { WatermarkStyle } from '@/entities/session'
import {
  measureWatermarkText,
  resolveWatermarkMode,
  resolveWatermarkPosition,
  watermarkSingleAnchor,
  watermarkTileOffsets,
} from './watermarkLayout'

/**
 * Draw text watermark over the full canvas.
 * - tile: density-based 2D grid (rotated about center); step from text metrics
 * - single: one label at `position` with AABB kept inside the canvas
 */
export function drawWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  style: WatermarkStyle,
): void {
  if (!style.enabled) return
  const text = style.text.trim()
  if (!text) return

  const fontSize = Math.max(8, style.fontSize)
  const opacity = Math.min(1, Math.max(0, style.opacity))
  const rotationRad = (style.rotation * Math.PI) / 180
  const mode = resolveWatermarkMode(style)

  ctx.save()
  ctx.globalAlpha = opacity
  ctx.fillStyle = '#000000'
  ctx.font = `${fontSize}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const metrics = measureWatermarkText(ctx, text, fontSize)

  if (mode === 'single') {
    const pos = resolveWatermarkPosition(style)
    const anchor = watermarkSingleAnchor(pos, width, height, metrics, style.rotation)
    ctx.translate(anchor.x, anchor.y)
    ctx.rotate(rotationRad)
    ctx.fillText(text, 0, 0)
  } else {
    ctx.translate(width / 2, height / 2)
    ctx.rotate(rotationRad)
    for (const p of watermarkTileOffsets(width, height, fontSize, style.density, metrics)) {
      ctx.fillText(text, p.x, p.y)
    }
  }

  ctx.restore()
}
