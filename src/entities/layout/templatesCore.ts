import type { LayoutDefinition } from './types'

/**
 * Core templates always registered (defaults + tests).
 * Full catalog loads asynchronously via ensureTemplateCatalog().
 */
export const CORE_TEMPLATES: LayoutDefinition[] = [
  {
    schemaVersion: 1,
    id: 'tpl_single',
    name: 'Single',
    imageCount: 1,
    grid: {
      rows: 1,
      cols: 1,
    },
    cells: [
      {
        row: 0,
        col: 0,
        rowSpan: 1,
        colSpan: 1,
      },
    ],
  },
  {
    schemaVersion: 1,
    id: 'tpl_split_h',
    name: 'Split horizontal',
    imageCount: 2,
    grid: {
      rows: 1,
      cols: 2,
    },
    cells: [
      {
        row: 0,
        col: 0,
        rowSpan: 1,
        colSpan: 1,
      },
      {
        row: 0,
        col: 1,
        rowSpan: 1,
        colSpan: 1,
      },
    ],
  },
  {
    schemaVersion: 1,
    id: 'tpl_split_v',
    name: 'Split vertical',
    imageCount: 2,
    grid: {
      rows: 2,
      cols: 1,
    },
    cells: [
      {
        row: 0,
        col: 0,
        rowSpan: 1,
        colSpan: 1,
      },
      {
        row: 1,
        col: 0,
        rowSpan: 1,
        colSpan: 1,
      },
    ],
  },
  {
    schemaVersion: 1,
    id: 'tpl_left_stack',
    name: 'Left + stack',
    imageCount: 3,
    grid: {
      rows: 2,
      cols: 2,
    },
    cells: [
      {
        row: 0,
        col: 0,
        rowSpan: 2,
        colSpan: 1,
      },
      {
        row: 0,
        col: 1,
        rowSpan: 1,
        colSpan: 1,
      },
      {
        row: 1,
        col: 1,
        rowSpan: 1,
        colSpan: 1,
      },
    ],
  },
  {
    schemaVersion: 1,
    id: 'tpl_grid_2x2',
    name: 'Grid 2×2',
    imageCount: 4,
    grid: {
      rows: 2,
      cols: 2,
    },
    cells: [
      {
        row: 0,
        col: 0,
        rowSpan: 1,
        colSpan: 1,
      },
      {
        row: 0,
        col: 1,
        rowSpan: 1,
        colSpan: 1,
      },
      {
        row: 1,
        col: 0,
        rowSpan: 1,
        colSpan: 1,
      },
      {
        row: 1,
        col: 1,
        rowSpan: 1,
        colSpan: 1,
      },
    ],
  },
  {
    schemaVersion: 1,
    id: 'tpl_grid_3x2',
    name: 'Grid 3×2',
    imageCount: 6,
    grid: {
      rows: 3,
      cols: 2,
    },
    cells: [
      {
        row: 0,
        col: 0,
        rowSpan: 1,
        colSpan: 1,
      },
      {
        row: 0,
        col: 1,
        rowSpan: 1,
        colSpan: 1,
      },
      {
        row: 1,
        col: 0,
        rowSpan: 1,
        colSpan: 1,
      },
      {
        row: 1,
        col: 1,
        rowSpan: 1,
        colSpan: 1,
      },
      {
        row: 2,
        col: 0,
        rowSpan: 1,
        colSpan: 1,
      },
      {
        row: 2,
        col: 1,
        rowSpan: 1,
        colSpan: 1,
      },
    ],
  },
  // Default collage / favicon pinwheel (center + 4 rotating arms)
  {
    schemaVersion: 1,
    id: 'tpl_5_center',
    name: '5 center',
    imageCount: 5,
    grid: {
      rows: 3,
      cols: 3,
    },
    cells: [
      {
        row: 0,
        col: 0,
        rowSpan: 1,
        colSpan: 2,
      },
      {
        row: 0,
        col: 2,
        rowSpan: 2,
        colSpan: 1,
      },
      {
        row: 1,
        col: 0,
        rowSpan: 2,
        colSpan: 1,
      },
      {
        row: 1,
        col: 1,
        rowSpan: 1,
        colSpan: 1,
      },
      {
        row: 2,
        col: 1,
        rowSpan: 1,
        colSpan: 2,
      },
    ],
  },
]
