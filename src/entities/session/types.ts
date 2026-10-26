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
