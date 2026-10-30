import type { LayoutDefinition } from '@/entities/layout'

/** Logical aspect ratio as width/height (e.g. 1/1, 4/3, 210/297 for A4). */
export type AspectRatio = {
  width: number
  height: number
}

/** Per-side border widths in CSS pixels (canvas-space later). */
export type BorderWidths = {
  top: number
  right: number
  bottom: number
  left: number
}

export type BackgroundStyle = {
  color: string
  /** Optional background image id from the in-memory image registry. */
  imageId: string | null
}

/** Tile fills the canvas; single places one label at `position`. */
export type WatermarkMode = 'tile' | 'single'

export type WatermarkPosition = 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

/** Max watermark label length (UTF-16 code units / string.length / HTML maxlength). */
export const WATERMARK_TEXT_MAX_LENGTH = 32

/** Max for spacing, radius, and per-side borders (preview CSS px; UI range + hydrate clamp). */
export const STYLE_LENGTH_MAX = 80

/** Round to integer then clamp to 0..STYLE_LENGTH_MAX (spacing/radius/borders step=1). */
export function clampStyleLength(value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.min(STYLE_LENGTH_MAX, Math.max(0, Math.round(value)))
}

/** Max custom aspect width/height side (UI max + store/hydrate clamp). */
export const ASPECT_SIDE_MIN = 1
export const ASPECT_SIDE_MAX = 9999

/** Clamp one aspect side to 1..ASPECT_SIDE_MAX; non-finite / non-positive → ASPECT_SIDE_MIN. */
export function clampAspectSide(value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || !(value > 0)) return ASPECT_SIDE_MIN
  return Math.min(ASPECT_SIDE_MAX, Math.max(ASPECT_SIDE_MIN, value))
}

/** Watermark fontSize UI range (LabeledRange 12–100); persist/hydrate prefer this over draw's Math.max(8,…). */
export const WATERMARK_FONT_SIZE_MIN = 12
export const WATERMARK_FONT_SIZE_MAX = 100

/** Watermark rotation UI range (degrees). */
export const WATERMARK_ROTATION_MIN = -90
export const WATERMARK_ROTATION_MAX = 90

/** Watermark tile density (draw clamps 1–5; UI buttons 1/2/4). */
export const WATERMARK_DENSITY_MIN = 1
export const WATERMARK_DENSITY_MAX = 5

export function clampWatermarkFontSize(value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return WATERMARK_FONT_SIZE_MIN
  return Math.min(WATERMARK_FONT_SIZE_MAX, Math.max(WATERMARK_FONT_SIZE_MIN, value))
}

export function clampWatermarkRotation(value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.min(WATERMARK_ROTATION_MAX, Math.max(WATERMARK_ROTATION_MIN, value))
}

export function clampWatermarkDensity(value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return WATERMARK_DENSITY_MIN
  return Math.min(WATERMARK_DENSITY_MAX, Math.max(WATERMARK_DENSITY_MIN, Math.round(value)))
}

/**
 * Watermark overlay settings.
 * `density` is a relative packing factor (1 = sparse … 5 = dense) for `mode: 'tile'`.
 * `position` is used when `mode: 'single'` (default center).
 */
export type WatermarkStyle = {
  enabled: boolean
  text: string
  fontSize: number
  opacity: number
  rotation: number
  density: number
  /** Default `tile` for backward compatibility. */
  mode: WatermarkMode
  /** Anchor for single mode; default `center`. */
  position: WatermarkPosition
}

/**
 * Export quality tier.
 * Pixel caps are applied in `computeExportSize` (see docs/DECISIONS.md).
 */
export type DownloadQuality = 'high-jpg' | 'medium-jpg' | 'png'

/** Pan offset inside a cell, percentages 0–100 (50/50 = centered). */
export type CellImagePosition = {
  x: number
  y: number
}

export type CellImageAssignment = {
  /**
   * Original registry image id (never a bake).
   * Display uses imageId (equals source when orientation is identity).
   */
  sourceImageId: string | null
  /**
   * Display registry id: source when no orientation bake, otherwise the bake.
   * Preview/export draw this bitmap with identity rotate/flip.
   */
  imageId: string | null
  position: CellImagePosition
  /** Extra zoom on top of cover-fit; default 1, clamp MIN–MAX. */
  scale: number
  /**
   * Logical clockwise rotation relative to sourceImageId (0 | 90 | 180 | 270).
   * Accumulated for (re)bake; not applied as CSS/canvas transform on the display bitmap.
   */
  rotation: number
  /**
   * Image-space mirror left-right relative to source (applied before rotation in bake).
   * UI 左右 / flip-horizontal buttons compose in screen space via flipCellHorizontalScreen.
   */
  flipX: boolean
  /**
   * Image-space mirror up-down relative to source (applied before rotation in bake).
   * UI 上下 / flip-vertical buttons compose in screen space via flipCellVerticalScreen.
   */
  flipY: boolean
}

/** Which UI control owns the current aspect ratio (mutually exclusive). */
export type AspectSource = 'common' | 'print' | 'custom'

export type CollageStyle = {
  aspectRatio: AspectRatio
  /** Optional print preset id (e.g. "A4"); null = screen/ratio-only. */
  printSizeId: string | null
  /**
   * Selected common aspect preset id (e.g. "3:2"); kept across orientation swap
   * so the landscape chip stays highlighted when store W/H is portrait.
   * Null when aspectSource is print/custom.
   */
  commonAspectId: string | null
  /** Tracks preset vs custom so swap does not infer from W/H matching. */
  aspectSource: AspectSource
  spacing: number
  radius: number
  borders: BorderWidths
  background: BackgroundStyle
  watermark: WatermarkStyle
  downloadQuality: DownloadQuality
}

/**
 * Serializable collage session snapshot (layout + style + cell assignments).
 * Image blobs live outside this snapshot (keyed by imageId).
 */
export type CollageSessionState = {
  layout: LayoutDefinition | null
  style: CollageStyle
  /** Parallel to layout.cells; resized when layout changes. */
  cellImages: CellImageAssignment[]
  /**
   * CSS-grid track weights parallel to `layout.grid.rows` / `.cols`.
   * Defaults all `1`; reset when layout id / grid size changes.
   */
  rowFractions: number[]
  colFractions: number[]
  selectedCellIndex: number | null
}

export const DEFAULT_CELL_POSITION: CellImagePosition = { x: 50, y: 50 }

export const DEFAULT_CELL_SCALE = 1
/** Cover baseline: never shrink below full-cover (no blank cell). */
export const MIN_CELL_SCALE = 1
export const MAX_CELL_SCALE = 5
/** Wheel / button step. */
export const CELL_SCALE_STEP = 0.1

export const DEFAULT_STYLE: CollageStyle = {
  aspectRatio: { width: 1, height: 1 },
  printSizeId: null,
  commonAspectId: '1:1',
  aspectSource: 'common',
  spacing: 10,
  radius: 20,
  borders: { top: 10, right: 10, bottom: 10, left: 10 },
  background: { color: '#ffffff', imageId: null },
  watermark: {
    enabled: false,
    text: '',
    fontSize: 20,
    opacity: 0.15,
    rotation: -30,
    density: 2,
    mode: 'tile',
    position: 'center',
  },
  downloadQuality: 'high-jpg',
}

/** Accept #RGB / #RRGGBB (case-insensitive); invalid or overlong → fallback. */
const BG_HEX_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/

/**
 * Sanitize a background color from hydrate / setStyle.
 * Color picker outputs #rrggbb; DEFAULT is #ffffff. `transparent` is not used for bg.
 */
export function sanitizeBackgroundColor(
  raw: unknown,
  fallback: string = DEFAULT_STYLE.background.color,
): string {
  if (typeof raw !== 'string') return fallback
  const trimmed = raw.trim()
  if (!BG_HEX_RE.test(trimmed)) return fallback
  const hex = trimmed.slice(1)
  if (hex.length === 3) {
    const [r, g, b] = hex.toLowerCase().split('') as [string, string, string]
    return `#${r}${r}${g}${g}${b}${b}`
  }
  return `#${hex.toLowerCase()}`
}

/** Clamp / coerce cell scale into the supported range. */
export function clampCellScale(scale: number | null | undefined): number {
  if (typeof scale !== 'number' || !Number.isFinite(scale)) return DEFAULT_CELL_SCALE
  return Math.min(MAX_CELL_SCALE, Math.max(MIN_CELL_SCALE, scale))
}

/** Reset pan / zoom / rotate / flip to defaults (does not touch image ids). */
export function resetCellVisualConfig(cell: CellImageAssignment): void {
  cell.position = { ...DEFAULT_CELL_POSITION }
  cell.scale = DEFAULT_CELL_SCALE
  cell.rotation = 0
  cell.flipX = false
  cell.flipY = false
}

export function createEmptyCellImages(count: number): CellImageAssignment[] {
  return Array.from({ length: count }, () => {
    const cell: CellImageAssignment = {
      sourceImageId: null,
      imageId: null,
      position: { ...DEFAULT_CELL_POSITION },
      scale: DEFAULT_CELL_SCALE,
      rotation: 0,
      flipX: false,
      flipY: false,
    }
    return cell
  })
}

/** Equal track weights (`1` × n) for a fresh grid size. */
export function createEqualFractions(count: number): number[] {
  const n = Math.max(0, Math.floor(count))
  return Array.from({ length: n }, () => 1)
}

export function createDefaultSessionState(): CollageSessionState {
  return {
    layout: null,
    style: structuredClone(DEFAULT_STYLE),
    cellImages: [],
    rowFractions: [],
    colFractions: [],
    selectedCellIndex: null,
  }
}
