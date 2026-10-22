/**
 * Pixel gutter hit-targets for collage track resize.
 * Emits segments only where two cells actually share a grid boundary
 * (avoids full-track ghosts across spanned irregular cells).
 */

import type { LayoutCell } from '@/entities/layout'
import { trackPixelSizes } from './trackFractions'

export type GutterOverlaySegment = {
  axis: 'row' | 'col'
  /** Gutter index between track i and i+1. */
  index: number
  /** Offset along the perpendicular axis (px from grid top-left). */
  start: number
  /** Length along the perpendicular axis (px). */
  length: number
  /** Center of the gap along the resize axis (px). */
  center: number
}

type Interval = { start: number; end: number }

/** Cumulative start offset of each track, plus total end as final entry. */
function trackOffsets(sizes: number[], gap: number): number[] {
  const offsets: number[] = [0]
  let acc = 0
  for (let i = 0; i < sizes.length; i += 1) {
    acc += sizes[i]!
    if (i < sizes.length - 1) acc += gap
    offsets.push(acc)
  }
  return offsets
}

/**
 * Pixel [start, end) covered by tracks [from, from+span), including gaps
 * between those tracks but not a trailing gap after the last.
 */
function cellTrackInterval(
  offsets: number[],
  trackCount: number,
  from: number,
  span: number,
  gap: number,
): Interval | null {
  const to = from + span
  if (from < 0 || span <= 0 || to > trackCount) return null
  const start = offsets[from]!
  // offsets[to] is either next-track start (includes trailing gap) or grid end.
  const rawEnd = offsets[to]!
  const end = to < trackCount ? rawEnd - gap : rawEnd
  if (end <= start) return null
  return { start, end }
}

function overlap(a: Interval, b: Interval): Interval | null {
  const start = Math.max(a.start, b.start)
  const end = Math.min(a.end, b.end)
  if (end <= start) return null
  return { start, end }
}

/** Merge overlapping / touching intervals; bridge gaps up to ridge (grid gap). */
function mergeIntervals(items: Interval[], bridge = 0): Interval[] {
  if (items.length === 0) return []
  const sorted = [...items].sort((x, y) => x.start - y.start || x.end - y.end)
  const out: Interval[] = [{ ...sorted[0]! }]
  for (let i = 1; i < sorted.length; i += 1) {
    const cur = sorted[i]!
    const last = out[out.length - 1]!
    if (cur.start <= last.end + bridge + 0.5) {
      last.end = Math.max(last.end, cur.end)
    } else {
      out.push({ ...cur })
    }
  }
  return out
}

/**
 * Build gutter overlay segments for a layout + measured track sizes.
 * Regular equal grids yield one full-span segment per gutter (after merge).
 * Irregular spans only keep segments on real shared edges.
 */
export function measureSharedGutterSegments(args: {
  cells: LayoutCell[]
  rowFractions: number[]
  colFractions: number[]
  gridWidth: number
  gridHeight: number
  gap: number
}): GutterOverlaySegment[] {
  const { cells, rowFractions, colFractions, gridWidth, gridHeight, gap } = args
  const rows = rowFractions.length
  const cols = colFractions.length
  if (rows <= 0 || cols <= 0 || gridWidth <= 0 || gridHeight <= 0) return []

  const gapPx = Math.max(0, gap)
  const usableW = Math.max(0, gridWidth - gapPx * Math.max(0, cols - 1))
  const usableH = Math.max(0, gridHeight - gapPx * Math.max(0, rows - 1))
  const colSizes = trackPixelSizes(colFractions, usableW)
  const rowSizes = trackPixelSizes(rowFractions, usableH)
  const colOffsets = trackOffsets(colSizes, gapPx)
  const rowOffsets = trackOffsets(rowSizes, gapPx)

  const out: GutterOverlaySegment[] = []

  // Vertical gutters (resize columns): shared edges between col g and g+1
  for (let g = 0; g < cols - 1; g += 1) {
    const leftCells = cells.filter((c) => c.col + c.colSpan === g + 1)
    const rightCells = cells.filter((c) => c.col === g + 1)
    const intervals: Interval[] = []
    for (const L of leftCells) {
      const lr = cellTrackInterval(rowOffsets, rows, L.row, L.rowSpan, gapPx)
      if (!lr) continue
      for (const R of rightCells) {
        const rr = cellTrackInterval(rowOffsets, rows, R.row, R.rowSpan, gapPx)
        if (!rr) continue
        const ov = overlap(lr, rr)
        if (ov) intervals.push(ov)
      }
    }
    const center = colOffsets[g + 1]! - gapPx / 2
    for (const seg of mergeIntervals(intervals, gapPx)) {
      out.push({
        axis: 'col',
        index: g,
        start: seg.start,
        length: seg.end - seg.start,
        center,
      })
    }
  }

  // Horizontal gutters (resize rows): shared edges between row g and g+1
  for (let g = 0; g < rows - 1; g += 1) {
    const topCells = cells.filter((c) => c.row + c.rowSpan === g + 1)
    const bottomCells = cells.filter((c) => c.row === g + 1)
    const intervals: Interval[] = []
    for (const T of topCells) {
      const tc = cellTrackInterval(colOffsets, cols, T.col, T.colSpan, gapPx)
      if (!tc) continue
      for (const B of bottomCells) {
        const bc = cellTrackInterval(colOffsets, cols, B.col, B.colSpan, gapPx)
        if (!bc) continue
        const ov = overlap(tc, bc)
        if (ov) intervals.push(ov)
      }
    }
    const center = rowOffsets[g + 1]! - gapPx / 2
    for (const seg of mergeIntervals(intervals, gapPx)) {
      out.push({
        axis: 'row',
        index: g,
        start: seg.start,
        length: seg.end - seg.start,
        center,
      })
    }
  }

  return out
}
