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
  imageId: string | null
  position: CellImagePosition
  /** Extra zoom on top of cover-fit; default 1, clamp MIN–MAX. */
  scale: number
}

export type CollageStyle = {
  aspectRatio: AspectRatio
  /** Optional print preset id (e.g. "A4"); null = screen/ratio-only. */
  printSizeId: string | null
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

/** Clamp / coerce cell scale into the supported range. */
export function clampCellScale(scale: number | null | undefined): number {
  if (typeof scale !== 'number' || !Number.isFinite(scale)) return DEFAULT_CELL_SCALE
  return Math.min(MAX_CELL_SCALE, Math.max(MIN_CELL_SCALE, scale))
}

export function createEmptyCellImages(count: number): CellImageAssignment[] {
  return Array.from({ length: count }, () => ({
    imageId: null,
    position: { ...DEFAULT_CELL_POSITION },
    scale: DEFAULT_CELL_SCALE,
  }))
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
