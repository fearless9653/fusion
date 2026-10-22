import type { LayoutCell, LayoutDefinition, LayoutGrid } from './types'

export type LayoutOpFailure = {
  ok: false
  reason: 'out_of_bounds' | 'overlap' | 'not_found' | 'invalid'
  message: string
}

export type LayoutOpSuccess = {
  ok: true
  cells: LayoutCell[]
}

export type LayoutOpResult = LayoutOpSuccess | LayoutOpFailure

/** Area of a single cell in grid units. */
export function cellArea(cell: LayoutCell): number {
  return cell.rowSpan * cell.colSpan
}

/** Sum of all cell areas (may exceed grid if overlapping). */
export function totalCoverage(cells: ReadonlyArray<LayoutCell>): number {
  return cells.reduce((sum, cell) => sum + cellArea(cell), 0)
}

/** True when the cell rectangle lies fully inside the grid. */
export function inBounds(cell: LayoutCell, grid: LayoutGrid): boolean {
  if (cell.row < 0 || cell.col < 0) return false
  if (cell.rowSpan < 1 || cell.colSpan < 1) return false
  return cell.row + cell.rowSpan <= grid.rows && cell.col + cell.colSpan <= grid.cols
}

/** Axis-aligned rectangle overlap (inclusive of edges sharing area). */
export function cellsOverlap(a: LayoutCell, b: LayoutCell): boolean {
  const aEndRow = a.row + a.rowSpan
  const aEndCol = a.col + a.colSpan
  const bEndRow = b.row + b.rowSpan
  const bEndCol = b.col + b.colSpan
  return a.row < bEndRow && aEndRow > b.row && a.col < bEndCol && aEndCol > b.col
}

/** True if `candidate` overlaps any cell in `cells` (optionally skipping one index). */
export function overlapsAny(
  candidate: LayoutCell,
  cells: ReadonlyArray<LayoutCell>,
  skipIndex = -1,
): boolean {
  for (let i = 0; i < cells.length; i += 1) {
    if (i === skipIndex) continue
    if (cellsOverlap(candidate, cells[i]!)) return true
  }
  return false
}

/**
 * Full coverage when cells are structurally valid (in-bounds, non-overlapping)
 * and their areas sum to rows * cols.
 */
export function isFullCoverage(layout: Pick<LayoutDefinition, 'grid' | 'cells'>): boolean {
  const { rows, cols } = layout.grid
  const occupied = Array.from({ length: rows }, () => Array.from({ length: cols }, () => false))

  for (const cell of layout.cells) {
    if (!inBounds(cell, layout.grid)) return false
    for (let r = cell.row; r < cell.row + cell.rowSpan; r += 1) {
      for (let c = cell.col; c < cell.col + cell.colSpan; c += 1) {
        if (occupied[r]![c]) return false
        occupied[r]![c] = true
      }
    }
  }

  return totalCoverage(layout.cells) === rows * cols
}

/** Empty cell list for a new custom grid (zero coverage). */
export function createEmptyGridCells(_rows?: number, _cols?: number): LayoutCell[] {
  return []
}

/** Unit (1×1) cells covering every grid square — useful reset baseline. */
export function createUnitGridCells(rows: number, cols: number): LayoutCell[] {
  const cells: LayoutCell[] = []
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      cells.push({ row, col, rowSpan: 1, colSpan: 1 })
    }
  }
  return cells
}

/**
 * Append a 1×1 cell for every uncovered unit square.
 * Existing cells are kept; new fillers are appended in row-major order.
 */
export function autoFillEmptyCells(
  grid: LayoutGrid,
  cells: ReadonlyArray<LayoutCell>,
): LayoutCell[] {
  const occupied = Array.from({ length: grid.rows }, () =>
    Array.from({ length: grid.cols }, () => false),
  )

  for (const cell of cells) {
    if (!inBounds(cell, grid)) continue
    for (let r = cell.row; r < cell.row + cell.rowSpan; r += 1) {
      for (let c = cell.col; c < cell.col + cell.colSpan; c += 1) {
        occupied[r]![c] = true
      }
    }
  }

  const next = cells.map((cell) => ({ ...cell }))
  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.cols; col += 1) {
      if (!occupied[row]![col]) {
        next.push({ row, col, rowSpan: 1, colSpan: 1 })
      }
    }
  }
  return next
}

export function addCell(
  grid: LayoutGrid,
  cells: ReadonlyArray<LayoutCell>,
  cell: LayoutCell,
): LayoutOpResult {
  if (!inBounds(cell, grid)) {
    return { ok: false, reason: 'out_of_bounds', message: 'Cell is out of bounds' }
  }
  if (overlapsAny(cell, cells)) {
    return { ok: false, reason: 'overlap', message: 'Cell overlaps an existing cell' }
  }
  return { ok: true, cells: [...cells, { ...cell }] }
}

export function removeCell(cells: ReadonlyArray<LayoutCell>, index: number): LayoutOpResult {
  if (index < 0 || index >= cells.length) {
    return { ok: false, reason: 'not_found', message: `No cell at index ${index}` }
  }
  return { ok: true, cells: cells.filter((_, i) => i !== index) }
}

export function moveCell(
  grid: LayoutGrid,
  cells: ReadonlyArray<LayoutCell>,
  index: number,
  to: { row: number; col: number },
): LayoutOpResult {
  const current = cells[index]
  if (!current) {
    return { ok: false, reason: 'not_found', message: `No cell at index ${index}` }
  }
  const moved: LayoutCell = {
    ...current,
    row: to.row,
    col: to.col,
  }
  if (!inBounds(moved, grid)) {
    return { ok: false, reason: 'out_of_bounds', message: 'Moved cell is out of bounds' }
  }
  if (overlapsAny(moved, cells, index)) {
    return { ok: false, reason: 'overlap', message: 'Moved cell overlaps another cell' }
  }
  const next = cells.map((cell, i) => (i === index ? moved : { ...cell }))
  return { ok: true, cells: next }
}

export function resizeCell(
  grid: LayoutGrid,
  cells: ReadonlyArray<LayoutCell>,
  index: number,
  size: { rowSpan: number; colSpan: number },
): LayoutOpResult {
  const current = cells[index]
  if (!current) {
    return { ok: false, reason: 'not_found', message: `No cell at index ${index}` }
  }
  if (size.rowSpan < 1 || size.colSpan < 1) {
    return { ok: false, reason: 'invalid', message: 'rowSpan and colSpan must be >= 1' }
  }
  const resized: LayoutCell = {
    ...current,
    rowSpan: size.rowSpan,
    colSpan: size.colSpan,
  }
  if (!inBounds(resized, grid)) {
    return { ok: false, reason: 'out_of_bounds', message: 'Resized cell is out of bounds' }
  }
  if (overlapsAny(resized, cells, index)) {
    return { ok: false, reason: 'overlap', message: 'Resized cell overlaps another cell' }
  }
  const next = cells.map((cell, i) => (i === index ? resized : { ...cell }))
  return { ok: true, cells: next }
}

/** Sync imageCount with cells.length after an edit. */
export function withSyncedImageCount(layout: LayoutDefinition): LayoutDefinition {
  return {
    ...layout,
    imageCount: layout.cells.length,
    cells: layout.cells.map((c) => ({ ...c })),
    grid: { ...layout.grid },
  }
}
