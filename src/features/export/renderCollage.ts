import type { LayoutDefinition } from '@/entities/layout'
import type { CellImageAssignment, CollageStyle } from '@/entities/session'
import { drawWatermark } from '@/features/watermark'
import { cellRectFromFractions, normalizeFractions } from '@/shared/lib'
import { computeExportSize, getPrintSizePreset } from './computeExportSize'
import { scaleStyleLengths, stylePxScale } from './styleScale'

export type RenderImageSource = {
  /** Prefer bitmap when available (export quality). */
  bitmap?: ImageBitmap | null
  /** Fallback HTMLImageElement / canvas / video frame. */
  element?: CanvasImageSource | null
  width: number
  height: number
}

export type RenderCollageInput = {
  layout: LayoutDefinition
  style: CollageStyle
  cellImages: CellImageAssignment[]
  /** Map imageId → drawable source */
  images: Map<string, RenderImageSource>
  /** Parallel to layout.grid.rows / .cols; defaults to equal 1s. */
  rowFractions?: number[]
  colFractions?: number[]
  /**
   * On-screen collage frame size in CSS pixels (from CollageCanvas).
   * When set, spacing / radius / borders are scaled by exportWidth / previewWidth
   * so export matches the preview look.
   */
  previewSize?: { width: number; height: number } | null
}

export type RenderCollageResult = {
  canvas: HTMLCanvasElement
  width: number
  height: number
  mimeType: string
  extension: 'jpg' | 'png'
}

function qualityMime(style: CollageStyle): {
  mimeType: string
  extension: 'jpg' | 'png'
  quality?: number
} {
  if (style.downloadQuality === 'png') {
    return { mimeType: 'image/png', extension: 'png' }
  }
  const quality = style.downloadQuality === 'medium-jpg' ? 0.82 : 0.92
  return { mimeType: 'image/jpeg', extension: 'jpg', quality }
}

/**
 * Cover-fit an image into a destination rect using object-position percentages (0–100),
 * then apply an extra `imageScale` (1 = plain cover). Shared by preview math + export.
 */
export function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  posX: number,
  posY: number,
  imageScale: number = 1,
): void {
  if (srcW <= 0 || srcH <= 0 || dw <= 0 || dh <= 0) return
  const cover = Math.max(dw / srcW, dh / srcH)
  const zoom = Number.isFinite(imageScale) && imageScale > 0 ? imageScale : 1
  const scale = cover * zoom
  const drawW = srcW * scale
  const drawH = srcH * scale
  const px = Math.min(100, Math.max(0, posX)) / 100
  const py = Math.min(100, Math.max(0, posY)) / 100
  const ox = dx + (dw - drawW) * px
  const oy = dy + (dh - drawH) * py

  ctx.save()
  ctx.beginPath()
  ctx.rect(dx, dy, dw, dh)
  ctx.clip()
  ctx.drawImage(source, ox, oy, drawW, drawH)
  ctx.restore()
}

/** Pure geometry for cover × scale × position (tests / CSS parity). */
export function coverDrawRect(
  srcW: number,
  srcH: number,
  dw: number,
  dh: number,
  posX: number,
  posY: number,
  imageScale: number = 1,
): { drawW: number; drawH: number; ox: number; oy: number } {
  const cover = Math.max(dw / srcW, dh / srcH)
  const zoom = Number.isFinite(imageScale) && imageScale > 0 ? imageScale : 1
  const scale = cover * zoom
  const drawW = srcW * scale
  const drawH = srcH * scale
  const px = Math.min(100, Math.max(0, posX)) / 100
  const py = Math.min(100, Math.max(0, posY)) / 100
  return {
    drawW,
    drawH,
    ox: (dw - drawW) * px,
    oy: (dh - drawH) * py,
  }
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2))
  ctx.beginPath()
  if (radius <= 0) {
    ctx.rect(x, y, w, h)
    return
  }
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

/**
 * Render the collage onto an offscreen canvas using layout geometry + images + watermark.
 */
export function renderCollage(input: RenderCollageInput): RenderCollageResult {
  const { layout, style, cellImages, images } = input
  const print = style.printSizeId ? getPrintSizePreset(style.printSizeId) : null
  const size = computeExportSize({
    aspectRatio: style.aspectRatio,
    printSize: print ? { widthMm: print.widthMm, heightMm: print.heightMm } : null,
    quality: style.downloadQuality,
  })

  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable')
  }

  // Background color
  ctx.fillStyle = style.background.color || '#ffffff'
  ctx.fillRect(0, 0, size.width, size.height)

  // Background image (cover)
  if (style.background.imageId) {
    const bg = images.get(style.background.imageId)
    const src = bg?.bitmap ?? bg?.element
    if (bg && src) {
      drawCoverImage(ctx, src, bg.width, bg.height, 0, 0, size.width, size.height, 50, 50)
    }
  }

  const { rows, cols } = layout.grid
  const previewW = input.previewSize?.width ?? 0
  const pxScale = stylePxScale(size.width, previewW)
  const scaled = scaleStyleLengths(style, pxScale)
  const borders = scaled.borders
  const padL = borders.left
  const padR = borders.right
  const padT = borders.top
  const padB = borders.bottom
  const innerW = Math.max(1, size.width - padL - padR)
  const innerH = Math.max(1, size.height - padT - padB)
  const gap = Math.max(0, scaled.spacing)
  const rowFractions = normalizeFractions(rows, input.rowFractions)
  const colFractions = normalizeFractions(cols, input.colFractions)
  const radius = Math.max(0, scaled.radius)

  layout.cells.forEach((cell, index) => {
    const assignment = cellImages[index]
    const rect = cellRectFromFractions({
      row: cell.row,
      col: cell.col,
      rowSpan: cell.rowSpan,
      colSpan: cell.colSpan,
      rowFractions,
      colFractions,
      innerWidth: innerW,
      innerHeight: innerH,
      gap,
    })
    const x = padL + rect.x
    const y = padT + rect.y
    const w = rect.w
    const h = rect.h

    ctx.save()
    roundRectPath(ctx, x, y, w, h, radius)
    ctx.clip()

    // Empty cell fill (subtle)
    ctx.fillStyle = '#e2e8f0'
    ctx.fillRect(x, y, w, h)

    if (assignment?.imageId) {
      const img = images.get(assignment.imageId)
      const src = img?.bitmap ?? img?.element
      if (img && src) {
        const pos = assignment.position
        const cellScale = assignment.scale ?? 1
        drawCoverImage(ctx, src, img.width, img.height, x, y, w, h, pos.x, pos.y, cellScale)
      }
    }

    ctx.restore()
  })

  drawWatermark(ctx, size.width, size.height, style.watermark)

  const meta = qualityMime(style)
  return {
    canvas,
    width: size.width,
    height: size.height,
    mimeType: meta.mimeType,
    extension: meta.extension,
  }
}

export async function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('canvas.toBlob returned null'))
          return
        }
        resolve(blob)
      },
      mimeType,
      quality,
    )
  })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * Copy image blob to clipboard; returns false when ClipboardItem is unavailable
 * (caller should fall back to download).
 */
export async function copyBlobToClipboard(blob: Blob): Promise<boolean> {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
    return false
  }
  // Prefer PNG for clipboard; convert if needed is left to caller.
  try {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
    return true
  } catch {
    return false
  }
}

export function exportFilename(extension: 'jpg' | 'png'): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `collage-${stamp}.${extension}`
}

/** JPEG quality for toBlob based on downloadQuality. */
export function jpegQualityFor(style: CollageStyle): number | undefined {
  if (style.downloadQuality === 'png') return undefined
  return style.downloadQuality === 'medium-jpg' ? 0.82 : 0.92
}
