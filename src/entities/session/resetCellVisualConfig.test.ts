import { describe, expect, it } from 'vitest'
import { DEFAULT_CELL_POSITION, DEFAULT_CELL_SCALE, resetCellVisualConfig } from './types'
import type { CellImageAssignment } from './types'

describe('resetCellVisualConfig', () => {
  it('resets pan, scale, rotation, and flips without touching image ids', () => {
    const cell: CellImageAssignment = {
      sourceImageId: 'src',
      imageId: 'bake',
      position: { x: 10, y: 90 },
      scale: 2.5,
      rotation: 90,
      flipX: true,
      flipY: true,
    }
    resetCellVisualConfig(cell)
    expect(cell.sourceImageId).toBe('src')
    expect(cell.imageId).toBe('bake')
    expect(cell.position).toEqual(DEFAULT_CELL_POSITION)
    expect(cell.scale).toBe(DEFAULT_CELL_SCALE)
    expect(cell.rotation).toBe(0)
    expect(cell.flipX).toBe(false)
    expect(cell.flipY).toBe(false)
  })
})
