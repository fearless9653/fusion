import { z } from 'zod'
import { cellsOverlap, inBounds, isFullCoverage as checkFullCoverage } from './ops'
import type { LayoutDefinition } from './types'

/** Max length for layout id and name (UI maxlength + zod; JSON import truncates). */
export const LAYOUT_STRING_MAX = 64

/** Truncate string fields to LAYOUT_STRING_MAX (matches watermark text hydrate). */
function truncateLayoutString(value: unknown): unknown {
  return typeof value === 'string' ? value.slice(0, LAYOUT_STRING_MAX) : value
}

const layoutCellSchema = z.object({
  row: z.number().int().nonnegative(),
  col: z.number().int().nonnegative(),
  rowSpan: z.number().int().positive(),
  colSpan: z.number().int().positive(),
})

const layoutGridSchema = z.object({
  rows: z.number().int().positive().max(20),
  cols: z.number().int().positive().max(20),
})

/**
 * Structural zod schema for LayoutDefinition v1.
 * Domain rules (non-overlap, in-bounds, imageCount) are checked in refine.
 * Full coverage is NOT required for structural validity — use isFullCoverage for handoff.
 */
export const layoutDefinitionSchema = z
  .object({
    schemaVersion: z.literal(1),
    // Truncate oversized ids/names on import (same spirit as watermark text clamp),
    // then enforce .max(64). Reject empty after truncate via .min(1).
    id: z.preprocess(truncateLayoutString, z.string().min(1).max(LAYOUT_STRING_MAX)),
    name: z.preprocess(truncateLayoutString, z.string().min(1).max(LAYOUT_STRING_MAX)),
    imageCount: z.number().int().nonnegative(),
    grid: layoutGridSchema,
    cells: z.array(layoutCellSchema).min(1),
  })
  .superRefine((layout, ctx) => {
    if (layout.imageCount !== layout.cells.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'imageCount must equal cells.length',
        path: ['imageCount'],
      })
    }

    const { rows, cols } = layout.grid
    const grid = { rows, cols }

    for (let i = 0; i < layout.cells.length; i += 1) {
      const cell = layout.cells[i]!
      if (!inBounds(cell, grid)) {
        ctx.addIssue({
          code: 'custom',
          message: `cell[${i}] is out of bounds for grid ${rows}x${cols}`,
          path: ['cells', i],
        })
        continue
      }

      for (let j = 0; j < i; j += 1) {
        const other = layout.cells[j]!
        if (cellsOverlap(cell, other)) {
          ctx.addIssue({
            code: 'custom',
            message: `cell[${i}] overlaps cell[${j}]`,
            path: ['cells', i],
          })
          break
        }
      }
    }
  })

export type LayoutDefinitionParsed = z.infer<typeof layoutDefinitionSchema>

export function parseLayoutDefinition(input: unknown): LayoutDefinition {
  return layoutDefinitionSchema.parse(input) as LayoutDefinition
}

export function safeParseLayoutDefinition(input: unknown) {
  return layoutDefinitionSchema.safeParse(input)
}

/** True when every grid cell is covered exactly once (handoff rule). */
export function isFullCoverage(layout: LayoutDefinition): boolean {
  const result = layoutDefinitionSchema.safeParse(layout)
  if (!result.success) return false
  return checkFullCoverage(layout)
}
