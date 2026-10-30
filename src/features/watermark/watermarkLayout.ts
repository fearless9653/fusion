/**
 * Shared watermark placement math for export canvas + CSS preview.
 */

import type { WatermarkPosition, WatermarkStyle } from '@/entities/session'
import { assertNever } from '@/shared/utils'

export type WatermarkPoint = { x: number; y: number }

export type TextMetrics = { width: number; height: number }

/** Density UI: sparse=1, medium=2, dense=4 → gap multiplier (higher = more space). */
const DENSITY_GAP_MUL: Record<number, number> = {
  1: 2.0,
  2: 1.55,
  3: 1.4,
  4: 1.25,
  5: 1.2,
}

/**
 * Approximate text size without a canvas (CSS preview / pure tests).
 * CJK ≈ 1em wide; Latin ≈ 0.55em.
 */
export function estimateTextSize(text: string, fontSize: number): TextMetrics {
  const fs = Math.max(8, fontSize)
  let width = 0
  for (const ch of text) {
    width += /[\u3400-\u9fff\uf900-\ufaff]/.test(ch) ? fs : fs * 0.55
  }
  return {
    width: Math.max(fs, width),
    height: fs * 1.2,
  }
}

/** Measure with Canvas 2D when available. */
export function measureWatermarkText(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontSize: number,
): TextMetrics {
  const fs = Math.max(8, fontSize)
  if (typeof ctx.measureText !== 'function') {
    return estimateTextSize(text, fs)
  }
  const prev = ctx.font
  ctx.font = `${fs}px sans-serif`
  const m = ctx.measureText(text)
  const ascent = m.actualBoundingBoxAscent
  const descent = m.actualBoundingBoxDescent
  const height =
    typeof ascent === 'number' && typeof descent === 'number' && ascent + descent > 0
      ? ascent + descent
      : fs * 1.2
  const width = Math.max(fs * 0.5, m.width)
  ctx.font = prev
  return { width, height: Math.max(fs, height) }
}

function densityGapMul(density: number): number {
  const d = Math.min(5, Math.max(1, Math.round(density)))
  // Keys 1–5 are always present after clamp.
  return DENSITY_GAP_MUL[d]!
}

/**
 * Tile spacing from text metrics.
 * step ≥ gapMul × metric + fontSize (gapMul 2.0 sparse … 1.2 dense).
 * X/Y independent so long strings do not overlap horizontally.
 */
export function watermarkTileSteps(
  fontSize: number,
  density: number,
  metrics: TextMetrics,
): { stepX: number; stepY: number } {
  const fs = Math.max(8, fontSize)
  const tw = Math.max(fs, metrics.width)
  const th = Math.max(fs, metrics.height)
  const mul = densityGapMul(density)
  const stepX = tw * mul + fs
  const stepY = th * mul + fs
  // Extra floor so short labels still feel sparse at density 1.
  const minMul = densityGapMul(density) >= 1.9 ? 6 : densityGapMul(density) >= 1.5 ? 4 : 3
  return {
    stepX: Math.max(stepX, fs * minMul),
    stepY: Math.max(stepY, fs * Math.max(2.5, minMul * 0.55)),
  }
}

/** Axis-aligned half-extents of a centered text box after rotation. */
export function rotatedTextHalfExtents(
  textWidth: number,
  textHeight: number,
  rotationDeg: number,
): { hw: number; hh: number } {
  const rad = (rotationDeg * Math.PI) / 180
  const c = Math.abs(Math.cos(rad))
  const s = Math.abs(Math.sin(rad))
  const hw = (textWidth / 2) * c + (textHeight / 2) * s
  const hh = (textWidth / 2) * s + (textHeight / 2) * c
  return { hw, hh }
}

/**
 * Single-mode anchor: keep the rotated text AABB inside the canvas
 * with at least `edgePad` (default max(8, fontSize/2)) from each edge.
 */
export function watermarkSingleAnchor(
  position: WatermarkPosition,
  canvasW: number,
  canvasH: number,
  metrics: TextMetrics,
  rotationDeg: number,
  edgePad?: number,
): WatermarkPoint {
  const wantedPad = Math.max(8, edgePad ?? Math.max(8, metrics.height / 2))
  const { hw, hh } = rotatedTextHalfExtents(metrics.width, metrics.height, rotationDeg)

  function axisRange(size: number, half: number, pad: number): { min: number; max: number } {
    let min = pad + half
    let max = size - pad - half
    if (min <= max) return { min, max }
    // Drop pad if the box is tight.
    min = half
    max = size - half
    if (min <= max) return { min, max }
    // Text larger than canvas — pin to center (best effort).
    const mid = size / 2
    return { min: mid, max: mid }
  }

  const xRange = axisRange(canvasW, hw, wantedPad)
  const yRange = axisRange(canvasH, hh, wantedPad)
  const cx = canvasW / 2
  const cy = canvasH / 2

  switch (position) {
    case 'top-left':
      return { x: xRange.min, y: yRange.min }
    case 'top-right':
      return { x: xRange.max, y: yRange.min }
    case 'bottom-left':
      return { x: xRange.min, y: yRange.max }
    case 'bottom-right':
      return { x: xRange.max, y: yRange.max }
    case 'center':
      return {
        x: Math.min(xRange.max, Math.max(xRange.min, cx)),
        y: Math.min(yRange.max, Math.max(yRange.min, cy)),
      }
    default:
      return assertNever(position)
  }
}

/**
 * Tile placements in a coordinate system centered on the canvas
 * (same frame `drawWatermark` uses after translate(center)).
 */
export function watermarkTileOffsets(
  width: number,
  height: number,
  fontSize: number,
  density: number,
  metrics?: TextMetrics,
): WatermarkPoint[] {
  const m = metrics ?? estimateTextSize('WM', fontSize)
  const { stepX, stepY } = watermarkTileSteps(fontSize, density, m)
  const diag = Math.sqrt(width * width + height * height)
  const out: WatermarkPoint[] = []
  for (let y = -diag; y <= diag; y += stepY) {
    for (let x = -diag; x <= diag; x += stepX) {
      out.push({ x, y })
    }
  }
  return out
}

export function resolveWatermarkMode(style: WatermarkStyle): 'tile' | 'single' {
  return style.mode === 'single' ? 'single' : 'tile'
}

export function resolveWatermarkPosition(style: WatermarkStyle): WatermarkPosition {
  const p = style.position
  if (
    p === 'top-left' ||
    p === 'top-right' ||
    p === 'bottom-left' ||
    p === 'bottom-right' ||
    p === 'center'
  ) {
    return p
  }
  return 'center'
}

/** True if a centered text AABB at (cx,cy) with half-extents fits in the canvas. */
export function isTextAabbInside(
  cx: number,
  cy: number,
  hw: number,
  hh: number,
  canvasW: number,
  canvasH: number,
  epsilon = 0.5,
): boolean {
  return (
    cx - hw >= -epsilon &&
    cy - hh >= -epsilon &&
    cx + hw <= canvasW + epsilon &&
    cy + hh <= canvasH + epsilon
  )
}
