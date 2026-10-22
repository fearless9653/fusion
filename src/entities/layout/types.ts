/**
 * LayoutDefinition v1 — readable fields only (see docs/SPEC.md).
 */
export type LayoutCell = {
  row: number
  col: number
  rowSpan: number
  colSpan: number
}

export type LayoutGrid = {
  rows: number
  cols: number
}

export type LayoutDefinition = {
  schemaVersion: 1
  id: string
  name: string
  imageCount: number
  grid: LayoutGrid
  cells: LayoutCell[]
}
