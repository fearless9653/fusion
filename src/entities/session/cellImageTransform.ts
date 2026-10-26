/** Per-cell image orientation (rotation + flips). Pure helpers for store / bake / export. */

export type CellRotationDeg = 0 | 90 | 180 | 270

export type CellImageTransform = {
  rotation: CellRotationDeg
  flipX: boolean
  flipY: boolean
}

export const DEFAULT_CELL_ROTATION: CellRotationDeg = 0
export const DEFAULT_CELL_FLIP_X = false
export const DEFAULT_CELL_FLIP_Y = false

export const DEFAULT_CELL_TRANSFORM: CellImageTransform = {
  rotation: DEFAULT_CELL_ROTATION,
  flipX: DEFAULT_CELL_FLIP_X,
  flipY: DEFAULT_CELL_FLIP_Y,
}

/** Snap to 0/90/180/270 (clockwise from positive x). */
export function normalizeCellRotation(deg: number | null | undefined): CellRotationDeg {
  if (typeof deg !== 'number' || !Number.isFinite(deg)) return DEFAULT_CELL_ROTATION
  const stepped = Math.round(deg / 90) * 90
  const mod = ((stepped % 360) + 360) % 360
  if (mod === 90 || mod === 180 || mod === 270) return mod
  return 0
}

/** Next clockwise 90 deg step. */
export function rotateCellCw(rotation: number | null | undefined): CellRotationDeg {
  return normalizeCellRotation(normalizeCellRotation(rotation) + 90)
}

export function resolveCellTransform(
  partial?: {
    rotation?: number | null
    flipX?: boolean | null
    flipY?: boolean | null
  } | null,
): CellImageTransform {
  return {
    rotation: normalizeCellRotation(partial?.rotation),
    flipX: Boolean(partial?.flipX),
    flipY: Boolean(partial?.flipY),
  }
}

/**
 * Map any rotation+flip combo onto one of ≤8 canonical orientations:
 * quarter-turn rotation × optional flipX (flipY always false).
 *
 * Bake order is flip-then-rotate; equivalences used:
 * - flipX∧flipY ≡ rotate +180°
 * - flipY alone ≡ flipX + rotate +180°
 */
export function toCanonicalCellTransform(
  partial?: {
    rotation?: number | null
    flipX?: boolean | null
    flipY?: boolean | null
  } | null,
): CellImageTransform {
  let { rotation, flipX, flipY } = resolveCellTransform(partial)
  if (flipX && flipY) {
    flipX = false
    flipY = false
    rotation = normalizeCellRotation(rotation + 180)
  } else if (flipY) {
    flipY = false
    flipX = !flipX
    rotation = normalizeCellRotation(rotation + 180)
  }
  return { rotation, flipX, flipY: false }
}

/** Structural equality for orientation (after caller canonicalizes if needed). */
export function cellTransformsEqual(
  a?: {
    rotation?: number | null
    flipX?: boolean | null
    flipY?: boolean | null
  } | null,
  b?: {
    rotation?: number | null
    flipX?: boolean | null
    flipY?: boolean | null
  } | null,
): boolean {
  const left = resolveCellTransform(a)
  const right = resolveCellTransform(b)
  return (
    left.rotation === right.rotation && left.flipX === right.flipX && left.flipY === right.flipY
  )
}

/** True when orientation bake is unnecessary (display === source). */
export function isIdentityCellTransform(
  partial?: {
    rotation?: number | null
    flipX?: boolean | null
    flipY?: boolean | null
  } | null,
): boolean {
  const tf = toCanonicalCellTransform(partial)
  return tf.rotation === 0 && !tf.flipX && !tf.flipY
}
