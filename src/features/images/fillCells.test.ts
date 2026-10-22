import { describe, expect, it, vi } from 'vitest'
import { assignImagesFromIndex, fillEmptyCells, imageFilesFromList } from './fillCells'

describe('fillEmptyCells', () => {
  it('fills only empty slots in order', () => {
    const cells = [{ imageId: 'a' }, { imageId: null }, { imageId: null }]
    const assign = vi.fn()
    const n = fillEmptyCells(cells, ['b', 'c', 'd'], assign)
    expect(n).toBe(2)
    expect(assign).toHaveBeenCalledWith(1, 'b')
    expect(assign).toHaveBeenCalledWith(2, 'c')
  })
})

describe('assignImagesFromIndex', () => {
  it('overwrites start then fills empties forward', () => {
    const cells = [{ imageId: 'a' }, { imageId: 'b' }, { imageId: null }, { imageId: null }]
    const assign = vi.fn()
    const n = assignImagesFromIndex(cells, ['x', 'y', 'z'], 1, assign)
    expect(n).toBe(3)
    expect(assign).toHaveBeenNthCalledWith(1, 1, 'x')
    expect(assign).toHaveBeenNthCalledWith(2, 2, 'y')
    expect(assign).toHaveBeenNthCalledWith(3, 3, 'z')
  })

  it('no-ops for out-of-range start', () => {
    const assign = vi.fn()
    expect(assignImagesFromIndex([{ imageId: null }], ['x'], 5, assign)).toBe(0)
    expect(assign).not.toHaveBeenCalled()
  })
})

describe('imageFilesFromList', () => {
  it('filters non-images', () => {
    const files = [
      new File([], 'a.png', { type: 'image/png' }),
      new File([], 'b.txt', { type: 'text/plain' }),
    ]
    expect(imageFilesFromList(files)).toHaveLength(1)
  })
})
