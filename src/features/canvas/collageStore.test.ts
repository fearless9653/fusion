import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getTemplate } from '@/entities/layout'
import { setOrientationBakeCoalesceMsForTests, useCollageStore } from './collageStore'

describe('useCollageStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    setOrientationBakeCoalesceMsForTests(0)
  })

  afterEach(() => {
    setOrientationBakeCoalesceMsForTests(null)
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
    expect(store.cellImages[0]?.sourceImageId).toBeNull()
    expect(store.cellImages[0]?.position).toEqual({ x: 20, y: 80 })
    expect(store.cellImages[0]?.scale).toBeCloseTo(1.5)
    store.undo()
    expect(store.cellImages[0]?.imageId).toBe('img_a')
  })

  it('clearAllCellImages clears assignments without resetting layout or style', () => {
    const store = useCollageStore()
    const layout = getTemplate('tpl_split_h')!
    store.setLayout(layout)
    store.setAspectRatio(16, 9, null, 'common', '16:9')
    store.setStyle({ spacing: 12 })
    store.assignImage(0, 'img_a')
    store.assignImage(1, 'img_b')
    store.panCell(0, { x: 10, y: 90 })
    store.setCellScale(1, 1.4)
    store.clearAllCellImages()
    expect(store.cellImages.every((c) => c.imageId === null && c.sourceImageId === null)).toBe(true)
    expect(store.cellImages[0]?.position).toEqual({ x: 10, y: 90 })
    expect(store.cellImages[1]?.scale).toBeCloseTo(1.4)
    expect(store.layout?.id).toBe(layout.id)
    expect(store.style.aspectRatio).toEqual({ width: 16, height: 9 })
    expect(store.style.spacing).toBe(12)
    store.undo()
    expect(store.cellImages[0]?.imageId).toBe('img_a')
    expect(store.cellImages[1]?.imageId).toBe('img_b')
  })

  it('assigns sourceImageId alongside imageId', () => {
    const store = useCollageStore()
    store.setLayout(getTemplate('tpl_single')!)
    store.assignImage(0, 'img_a')
    expect(store.cellImages[0]?.sourceImageId).toBe('img_a')
    expect(store.cellImages[0]?.imageId).toBe('img_a')
  })

  it('rotates and flips a cell with undo (canonical flipY)', async () => {
    const store = useCollageStore()
    store.setLayout(getTemplate('tpl_single')!)
    store.assignImage(0, 'img_a')
    expect(store.cellImages[0]?.rotation).toBe(0)
    expect(store.cellImages[0]?.flipX).toBe(false)
    expect(store.cellImages[0]?.flipY).toBe(false)
    await store.rotateCellImageCw(0)
    expect(store.cellImages[0]?.rotation).toBe(90)
    expect(store.cellImages[0]?.sourceImageId).toBe('img_a')
    // Without a real registry bitmap, display stays on source id (stub-safe).
    expect(store.cellImages[0]?.imageId).toBe('img_a')
    await store.rotateCellImageCw(0)
    expect(store.cellImages[0]?.rotation).toBe(180)
    await store.flipCellImageX(0)
    expect(store.cellImages[0]?.flipX).toBe(true)
    expect(store.cellImages[0]?.flipY).toBe(false)
    // flipY is canonicalized: (180, flipX) + flipY → identity
    await store.flipCellImageY(0)
    expect(store.cellImages[0]?.rotation).toBe(0)
    expect(store.cellImages[0]?.flipX).toBe(false)
    expect(store.cellImages[0]?.flipY).toBe(false)
    store.undo()
    expect(store.cellImages[0]?.rotation).toBe(180)
    expect(store.cellImages[0]?.flipX).toBe(true)
    store.undo()
    expect(store.cellImages[0]?.flipX).toBe(false)
    store.undo()
    expect(store.cellImages[0]?.rotation).toBe(90)
  })

  it('rotate then flipH then rotate yields flipX (screen composition)', async () => {
    const store = useCollageStore()
    store.setLayout(getTemplate('tpl_single')!)
    store.assignImage(0, 'img_a')
    await store.rotateCellImageCw(0)
    await store.flipCellImageX(0)
    await store.rotateCellImageCw(0)
    expect(store.cellImages[0]?.rotation).toBe(0)
    expect(store.cellImages[0]?.flipX).toBe(true)
    expect(store.cellImages[0]?.flipY).toBe(false)
  })

  it('after rotate 90° CW, flipH is screen-left-right (canonical 270+flipX)', async () => {
    const store = useCollageStore()
    store.setLayout(getTemplate('tpl_single')!)
    store.assignImage(0, 'img_a')
    await store.rotateCellImageCw(0)
    expect(store.cellImages[0]?.rotation).toBe(90)
    await store.flipCellImageX(0)
    // Screen H after R90 ≡ local flipY → canonical (270, flipX)
    expect(store.cellImages[0]?.rotation).toBe(270)
    expect(store.cellImages[0]?.flipX).toBe(true)
    expect(store.cellImages[0]?.flipY).toBe(false)
    await store.flipCellImageX(0)
    expect(store.cellImages[0]?.rotation).toBe(90)
    expect(store.cellImages[0]?.flipX).toBe(false)
    expect(store.cellImages[0]?.flipY).toBe(false)
  })

  it('clearCellImage resets orientation transforms and clears source', async () => {
    const store = useCollageStore()
    store.setLayout(getTemplate('tpl_single')!)
    store.assignImage(0, 'img_a')
    await store.rotateCellImageCw(0)
    await store.flipCellImageX(0)
    store.clearCellImage(0)
    expect(store.cellImages[0]?.imageId).toBeNull()
    expect(store.cellImages[0]?.sourceImageId).toBeNull()
    expect(store.cellImages[0]?.rotation).toBe(0)
    expect(store.cellImages[0]?.flipX).toBe(false)
    expect(store.cellImages[0]?.flipY).toBe(false)
  })

  it('clearAllCellImages resets orientation on every cell', async () => {
    const store = useCollageStore()
    store.setLayout(getTemplate('tpl_split_h')!)
    store.assignImage(0, 'img_a')
    store.assignImage(1, 'img_b')
    await store.rotateCellImageCw(0)
    await store.flipCellImageY(1)
    store.clearAllCellImages()
    expect(store.cellImages.every((c) => c.imageId === null && c.sourceImageId === null)).toBe(true)
    expect(store.cellImages.every((c) => c.rotation === 0 && !c.flipX && !c.flipY)).toBe(true)
  })
})
