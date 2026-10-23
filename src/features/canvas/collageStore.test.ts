import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { getTemplate } from '@/entities/layout'
import { useCollageStore } from './collageStore'

describe('useCollageStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('sets layout and resizes cell image slots', () => {
    const store = useCollageStore()
    const tpl = getTemplate('tpl_grid_2x2')!
    store.setLayout(tpl)
    expect(store.layout?.id).toBe('tpl_grid_2x2')
    expect(store.cellImages).toHaveLength(4)
    expect(store.cellImages[0]?.scale).toBe(1)
  })

  it('resets equal track fractions when layout changes', () => {
    const store = useCollageStore()
    store.setLayout(getTemplate('tpl_grid_2x2')!)
    expect(store.rowFractions).toEqual([1, 1])
    expect(store.colFractions).toEqual([1, 1])
    store.setColFractions([2, 1])
    expect(store.colFractions).toEqual([2, 1])
    store.setLayout(getTemplate('tpl_split_h')!)
    expect(store.rowFractions).toEqual([1])
    expect(store.colFractions).toEqual([1, 1])
  })

  it('redistributes adjacent columns and undoes', () => {
    const store = useCollageStore()
    store.setLayout(getTemplate('tpl_grid_2x2')!)
    store.redistributeColGutter(0, 0.5)
    expect(store.colFractions[0]).toBeCloseTo(1.5)
    expect(store.colFractions[1]).toBeCloseTo(0.5)
    store.undo()
    expect(store.colFractions).toEqual([1, 1])
  })

  it('assigns, pans, swaps, and undoes', () => {
    const store = useCollageStore()
    store.setLayout(getTemplate('tpl_split_h')!)
    store.assignImage(0, 'img_a')
    store.assignImage(1, 'img_b')
    store.panCell(0, { x: 10, y: 90 })
    store.swapCells(0, 1)
    expect(store.cellImages[0]?.imageId).toBe('img_b')
    expect(store.cellImages[1]?.imageId).toBe('img_a')

    store.undo()
    expect(store.cellImages[0]?.imageId).toBe('img_a')
    store.redo()
    expect(store.cellImages[0]?.imageId).toBe('img_b')
  })

  it('scales a cell and clamps, with undo', () => {
    const store = useCollageStore()
    store.setLayout(getTemplate('tpl_single')!)
    store.assignImage(0, 'img_a')
    expect(store.cellImages[0]?.scale).toBe(1)
    store.scaleCell(0, 0.5)
    expect(store.cellImages[0]?.scale).toBeCloseTo(1.5)
    store.setCellScale(0, 99)
    expect(store.cellImages[0]?.scale).toBe(5)
    store.setCellScale(0, 0.01)
    expect(store.cellImages[0]?.scale).toBe(1)
    store.undo()
    expect(store.cellImages[0]?.scale).toBe(5)
  })

  it('resetStyles restores defaults and applyCustomLayout requires coverage', () => {
    const store = useCollageStore()
    store.setStyle({ spacing: 99, downloadQuality: 'png' })
    store.resetStyles()
    expect(store.style.spacing).toBe(10)
    expect(store.style.radius).toBe(20)
    expect(store.style.borders).toEqual({ top: 10, right: 10, bottom: 10, left: 10 })
    expect(store.style.downloadQuality).toBe('high-jpg')

    expect(() =>
      store.applyCustomLayout({
        schemaVersion: 1,
        id: 'partial',
        name: 'Partial',
        imageCount: 1,
        grid: { rows: 2, cols: 2 },
        cells: [{ row: 0, col: 0, rowSpan: 1, colSpan: 1 }],
      }),
    ).toThrow(/fully cover/)
  })

  it('selectCell clamps to available indices', () => {
    const store = useCollageStore()
    store.setLayout(getTemplate('tpl_single')!)
    store.selectCell(0)
    expect(store.selectedCellIndex).toBe(0)
    store.selectCell(5)
    expect(store.selectedCellIndex).toBeNull()
  })

  it('selectCell(null) clears selection', () => {
    const store = useCollageStore()
    store.setLayout(getTemplate('tpl_single')!)
    store.selectCell(0)
    expect(store.selectedCellIndex).toBe(0)
    store.selectCell(null)
    expect(store.selectedCellIndex).toBeNull()
  })

  it('setAspectRatio persists explicit aspectSource through common swap', () => {
    const store = useCollageStore()
    expect(store.style.aspectSource).toBe('common')
    expect(store.style.aspectRatio).toEqual({ width: 1, height: 1 })
    expect(store.style.commonAspectId).toBe('1:1')

    store.setAspectRatio(3, 2, null, 'common', '3:2')
    expect(store.style.aspectSource).toBe('common')
    expect(store.style.printSizeId).toBeNull()
    expect(store.style.commonAspectId).toBe('3:2')

    // Simulate StylePanel common swap: flip W/H, omit id → keep commonAspectId
    store.setAspectRatio(2, 3, null, 'common')
    expect(store.style.aspectSource).toBe('common')
    expect(store.style.aspectRatio).toEqual({ width: 2, height: 3 })
    expect(store.style.printSizeId).toBeNull()
    expect(store.style.commonAspectId).toBe('3:2')

    store.setAspectRatio(210, 297, 'A4', 'print')
    expect(store.style.aspectSource).toBe('print')
    expect(store.style.printSizeId).toBe('A4')
    expect(store.style.commonAspectId).toBeNull()

    store.setAspectRatio(5, 7, null, 'custom')
    expect(store.style.aspectSource).toBe('custom')
    expect(store.style.printSizeId).toBeNull()
    expect(store.style.commonAspectId).toBeNull()

    store.resetStyles()
    expect(store.style.aspectSource).toBe('common')
    expect(store.style.commonAspectId).toBe('1:1')
  })

  it('clearCellImage removes assignment only', () => {
    const store = useCollageStore()
    store.setLayout(getTemplate('tpl_split_h')!)
    store.assignImage(0, 'img_a')
    store.panCell(0, { x: 20, y: 80 })
    store.setCellScale(0, 1.5)
    store.clearCellImage(0)
    expect(store.cellImages[0]?.imageId).toBeNull()
    expect(store.cellImages[0]?.position).toEqual({ x: 20, y: 80 })
    expect(store.cellImages[0]?.scale).toBeCloseTo(1.5)
    store.undo()
    expect(store.cellImages[0]?.imageId).toBe('img_a')
  })
})
