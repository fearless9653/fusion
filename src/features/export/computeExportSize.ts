import type { AspectRatio, DownloadQuality } from '@/entities/session'

/**
 * Export pixel sizing.
 *
 * Defaults (documented in docs/DECISIONS.md — confirm with product):
 * - Screen / ratio-only export uses quality max-edge caps below.
 * - Print presets use 300 DPI unless overridden.
 * - A4 portrait mm → inches → px: 210×297 mm @ 300 DPI ≈ 2480×3508.
 * - Screen (and print-in-box) sizes prefer exact aspect ratio with both
 *   dimensions divisible by 10; long edge may sit slightly under the quality cap.
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

/** Portrait-only presets for the style panel (landscape *-L stay in PRINT_SIZE_PRESETS for export/swap). */
export const PORTRAIT_PRINT_SIZE_PRESETS: PrintSizePreset[] = PRINT_SIZE_PRESETS.filter(
  (p) => !p.id.endsWith('-L'),
)

/** Pair base id: `4R-L` → `4R`, `4R` → `4R`. */
export function printSizePairBase(id: string): string {
  return id.endsWith('-L') ? id.slice(0, -2) : id
}

/** Remap orientation within a print pair: `4R` ↔ `4R-L`. Undefined if no pair exists. */
export function getPairedPrintSizeId(id: string): string | undefined {
  const paired = id.endsWith('-L') ? id.slice(0, -2) : `${id}-L`
  return PRINT_SIZE_PRESETS.some((p) => p.id === paired) ? paired : undefined
}

/** True when both ids belong to the same portrait/landscape print pair. */
export function isSamePrintSizePair(a: string, b: string): boolean {
  return printSizePairBase(a) === printSizePairBase(b)
}

/**
 * Common screen aspect ratios (ops-coffee “画布设置” set).
 * Print-oriented ratios (2:3 / 3:2 / 5:7 / …) live under PRINT_SIZE_PRESETS.
 */
export const ASPECT_RATIO_PRESETS: Array<{ id: string; ratio: AspectRatio }> = [
  { id: '1:1', ratio: { width: 1, height: 1 } },
  { id: '16:9', ratio: { width: 16, height: 9 } },
  { id: '16:10', ratio: { width: 16, height: 10 } },
  { id: '4:3', ratio: { width: 4, height: 3 } },
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

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a))
  let y = Math.abs(Math.trunc(b))
  while (y !== 0) {
    const t = y
    y = x % y
    x = t
  }
  return x || 1
}

function lcm(a: number, b: number): number {
  return (a / gcd(a, b)) * b
}

/**
 * Largest exact-ratio size with both dimensions divisible by 10 that fits in
 * maxW×maxH. Long edge may sit slightly under the box / quality cap.
 */
function fitExactAspectMod10(ratio: AspectRatio, maxW: number, maxH: number): ExportSize {
  const { width: rawRw, height: rawRh } = ratio
  if (rawRw <= 0 || rawRh <= 0) {
    throw new Error('aspectRatio width/height must be positive')
  }
  const g = gcd(rawRw, rawRh)
  const rw = rawRw / g
  const rh = rawRh / g
  // Smallest positive k0 such that rw*k0 and rh*k0 are both multiples of 10.
  const k0 = lcm(10 / gcd(rw, 10), 10 / gcd(rh, 10))
  const maxK = Math.min(Math.floor(maxW / rw), Math.floor(maxH / rh))
  let k = Math.floor(maxK / k0) * k0
  if (k < k0) {
    // Box smaller than one mod-10 step — still emit the minimal exact mod-10 size.
    k = k0
  }
  return { width: rw * k, height: rh * k }
}

function fitToMaxEdge(ratio: AspectRatio, maxEdge: number): ExportSize {
  return fitExactAspectMod10(ratio, maxEdge, maxEdge)
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
    // Largest exact-aspect, mod-10 size that fits in the raw print pixel box.
    return fitExactAspectMod10(aspectRatio, rawW, rawH)
  }

  return fitToMaxEdge(aspectRatio, maxEdge)
}

export function getPrintSizePreset(id: string): PrintSizePreset | undefined {
  return PRINT_SIZE_PRESETS.find((p) => p.id === id)
}
