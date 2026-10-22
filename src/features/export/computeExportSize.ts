import type { AspectRatio, DownloadQuality } from '@/entities/session'

/**
 * Export pixel sizing.
 *
 * Defaults (documented in docs/DECISIONS.md — confirm with product):
 * - Screen / ratio-only export uses quality max-edge caps below.
 * - Print presets use 300 DPI unless overridden.
 * - A4 portrait mm → inches → px: 210×297 mm @ 300 DPI ≈ 2480×3508.
 */

/** Default print resolution (pixels per inch). */
export const DEFAULT_PRINT_DPI = 300

/**
 * Max long-edge pixels by quality when not printing.
 * high-jpg / png → 4000; medium-jpg → 2000.
 */
export const QUALITY_MAX_EDGE: Record<DownloadQuality, number> = {
  'high-jpg': 4000,
  'medium-jpg': 2000,
  png: 4000,
}

/**
 * Print / photo paper sizes (ops-coffee parity).
 * `labelKey` → i18n `collage.printSize.*`; ratio shown beside label in UI.
 */
export type PrintSizePreset = {
  id: string
  /** i18n key under collage.printSize */
  labelKey: string
  /** Short ratio tag for the button, e.g. 2:3 */
  ratioLabel: string
  widthMm: number
  heightMm: number
}

export const PRINT_SIZE_PRESETS: PrintSizePreset[] = [
  { id: '4R', labelKey: '4R', ratioLabel: '2:3', widthMm: 102, heightMm: 152 },
  { id: '4R-L', labelKey: '4RL', ratioLabel: '3:2', widthMm: 152, heightMm: 102 },
  { id: '5R', labelKey: '5R', ratioLabel: '5:7', widthMm: 127, heightMm: 178 },
  { id: '5R-L', labelKey: '5RL', ratioLabel: '7:5', widthMm: 178, heightMm: 127 },
  { id: '8R', labelKey: '8R', ratioLabel: '4:5', widthMm: 203, heightMm: 254 },
  { id: '8R-L', labelKey: '8RL', ratioLabel: '5:4', widthMm: 254, heightMm: 203 },
  { id: 'A4', labelKey: 'A4', ratioLabel: '210:297', widthMm: 210, heightMm: 297 },
  { id: 'A4-L', labelKey: 'A4L', ratioLabel: '297:210', widthMm: 297, heightMm: 210 },
]

/**
 * Common screen aspect ratios (ops-coffee “画布设置” set).
 * Print-oriented ratios (2:3 / 3:2 / 5:7 / …) live under PRINT_SIZE_PRESETS.
 */
export const ASPECT_RATIO_PRESETS: Array<{ id: string; ratio: AspectRatio }> = [
  { id: '1:1', ratio: { width: 1, height: 1 } },
  { id: '16:9', ratio: { width: 16, height: 9 } },
  { id: '9:16', ratio: { width: 9, height: 16 } },
  { id: '16:10', ratio: { width: 16, height: 10 } },
  { id: '4:3', ratio: { width: 4, height: 3 } },
  { id: '3:4', ratio: { width: 3, height: 4 } },
]

export type ComputeExportSizeInput = {
  aspectRatio: AspectRatio
  /** When set, size is derived from physical mm × dpi (aspect still enforced). */
  printSize?: Pick<PrintSizePreset, 'widthMm' | 'heightMm'> | null
  quality: DownloadQuality
  /** Override long-edge cap (pixels). Defaults from QUALITY_MAX_EDGE. */
  maxEdge?: number
  /** Print DPI when printSize is set. Default DEFAULT_PRINT_DPI. */
  dpi?: number
}

export type ExportSize = {
  width: number
  height: number
}

function mmToPx(mm: number, dpi: number): number {
  return Math.round((mm / 25.4) * dpi)
}

function fitToMaxEdge(ratio: AspectRatio, maxEdge: number): ExportSize {
  const { width: rw, height: rh } = ratio
  if (rw <= 0 || rh <= 0) {
    throw new Error('aspectRatio width/height must be positive')
  }
  if (rw >= rh) {
    const width = Math.round(maxEdge)
    const height = Math.max(1, Math.round((maxEdge * rh) / rw))
    return { width, height }
  }
  const height = Math.round(maxEdge)
  const width = Math.max(1, Math.round((maxEdge * rw) / rh))
  return { width, height }
}

/**
 * Compute export canvas pixel size from aspect ratio, optional print size, and quality.
 */
export function computeExportSize(input: ComputeExportSizeInput): ExportSize {
  const { aspectRatio, printSize = null, quality } = input
  const maxEdge = input.maxEdge ?? QUALITY_MAX_EDGE[quality]
  const dpi = input.dpi ?? DEFAULT_PRINT_DPI

  if (printSize) {
    const rawW = mmToPx(printSize.widthMm, dpi)
    const rawH = mmToPx(printSize.heightMm, dpi)
    // Prefer physical print pixels; nudge to exact aspect if off by rounding.
    const target = aspectRatio.width / aspectRatio.height
    const actual = rawW / rawH
    if (Math.abs(target - actual) < 0.01) {
      return { width: rawW, height: rawH }
    }
    // Fit print box into the requested aspect (letterbox within print px).
    if (target > actual) {
      return { width: rawW, height: Math.max(1, Math.round(rawW / target)) }
    }
    return { width: Math.max(1, Math.round(rawH * target)), height: rawH }
  }

  return fitToMaxEdge(aspectRatio, maxEdge)
}

export function getPrintSizePreset(id: string): PrintSizePreset | undefined {
  return PRINT_SIZE_PRESETS.find((p) => p.id === id)
}
