/**
 * Pure helpers for CSS-grid track fractions (row/col).
 * Session stores parallel arrays; gutters redistribute adjacent tracks.
 */

export const DEFAULT_MIN_FRACTION = 0.15

/** Ensure a positive fraction list of exact `length` (default fill = 1). */
export function normalizeFractions(length: number, existing?: number[] | null): number[] {
  const n = Math.max(0, Math.floor(length))
  if (n === 0) return []
  const out: number[] = []
  for (let i = 0; i < n; i += 1) {
    const v = existing?.[i]
    out.push(typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 1)
  }
  return out
}

/**
 * Drag gutter `gutterIndex` (between track i and i+1).
 * Positive `deltaNormalized` grows track i and shrinks track i+1.
 * Clamps so neither track falls below `minFraction`.
 */
export function redistributeAdjacent(
  fractions: number[],
  gutterIndex: number,
  deltaNormalized: number,
  minFraction: number = DEFAULT_MIN_FRACTION,
): number[] {
  const next = [...fractions]
  const i = gutterIndex
  if (i < 0 || i + 1 >= next.length) return next
  if (!Number.isFinite(deltaNormalized) || deltaNormalized === 0) return next

  const min = Math.max(0, minFraction)
  let a = next[i]!
  let b = next[i + 1]!
  let delta = deltaNormalized

  if (delta > 0) {
    const maxGrow = Math.max(0, b - min)
    delta = Math.min(delta, maxGrow)
  } else {
    const maxShrink = Math.max(0, a - min)
    delta = Math.max(delta, -maxShrink)
  }

  a += delta
  b -= delta
  next[i] = a
  next[i + 1] = b
  return next
}

/** Pixel sizes for each track given usable axis length (gaps excluded). */
export function trackPixelSizes(fractions: number[], usablePx: number): number[] {
  const fr = normalizeFractions(fractions.length, fractions)
  const sum = fr.reduce((acc, v) => acc + v, 0)
  if (sum <= 0 || usablePx <= 0) return fr.map(() => 0)
  return fr.map((v) => (v / sum) * usablePx)
}

/**
 * Cell rect inside the padded content box (origin top-left of inner area).
 * Spanned tracks include the gaps between them.
 */
export function cellRectFromFractions(args: {
  row: number
  col: number
  rowSpan: number
  colSpan: number
  rowFractions: number[]
  colFractions: number[]
  innerWidth: number
  innerHeight: number
  gap: number
}): { x: number; y: number; w: number; h: number } {
  const { row, col, rowSpan, colSpan, rowFractions, colFractions, innerWidth, innerHeight, gap } =
    args
  const rows = rowFractions.length
  const cols = colFractions.length
  const gapPx = Math.max(0, gap)
  const usableW = Math.max(0, innerWidth - gapPx * Math.max(0, cols - 1))
  const usableH = Math.max(0, innerHeight - gapPx * Math.max(0, rows - 1))
  const colSizes = trackPixelSizes(colFractions, usableW)
  const rowSizes = trackPixelSizes(rowFractions, usableH)

  let x = 0
  for (let c = 0; c < col; c += 1) {
    x += (colSizes[c] ?? 0) + gapPx
  }
  let y = 0
  for (let r = 0; r < row; r += 1) {
    y += (rowSizes[r] ?? 0) + gapPx
  }

  let w = 0
  for (let c = col; c < col + colSpan; c += 1) {
    w += colSizes[c] ?? 0
    if (c > col) w += gapPx
  }
  let h = 0
  for (let r = row; r < row + rowSpan; r += 1) {
    h += rowSizes[r] ?? 0
    if (r > row) h += gapPx
  }

  return { x, y, w, h }
}

/** CSS `grid-template-*` value from fractions (`1fr 2fr …`). */
export function fractionsToCssTemplate(fractions: number[]): string {
  const fr = normalizeFractions(fractions.length, fractions)
  if (fr.length === 0) return 'none'
  return fr.map((v) => `${v}fr`).join(' ')
}
