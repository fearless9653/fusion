import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getTemplate } from '@/entities/layout'

vi.mock('@/features/images/bakeOrientedImage', async () => {
  const actual = await vi.importActual<typeof import('@/features/images/bakeOrientedImage')>(
    '@/features/images/bakeOrientedImage',
  )
  return {
    ...actual,
    bakeOrientedImage: vi.fn(async (source: { width: number; height: number }, transform) => {
      const rot = transform?.rotation ?? 0
      const swap = rot === 90 || rot === 270
      return {
        bitmap: {
          close: vi.fn(),
          width: swap ? source.height : source.width,
          height: swap ? source.width : source.height,
        },
        blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }),
        width: swap ? source.height : source.width,
        height: swap ? source.width : source.height,
        mimeType: 'image/png',
      }
    }),
  }
})

import { useImageRegistry } from '@/features/images'
import { setOrientationBakeCoalesceMsForTests, useCollageStore } from './collageStore'

function seedSource(width = 40, height = 20): string {
  const registry = useImageRegistry()
  const id = 'src_cell_1'
  const next = new Map(registry.images)
  next.set(id, {
    id,
    name: 'cell.png',
    objectUrl: 'blob:test-cell',
    bitmap: null,
    width,
    height,
    mimeType: 'image/png',
    derivedFromId: null,
    bakeTransform: null,
  })
  registry.images = next
  return id
}

describe('useCollageStore eager orientation bake', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock-bake'),
      revokeObjectURL: vi.fn(),
    })
    setActivePinia(createPinia())
    useImageRegistry().reset()
    useCollageStore().resetSession()
    setOrientationBakeCoalesceMsForTests(0)
  })

  afterEach(() => {
    setOrientationBakeCoalesceMsForTests(null)
  })

  it('bakes display from source on rotate and cascades on clear', async () => {
    const store = useCollageStore()
    const registry = useImageRegistry()
    store.setLayout(getTemplate('tpl_single')!)
    const sourceId = seedSource()
    store.assignImage(0, sourceId)
    expect(store.cellImages[0]?.sourceImageId).toBe(sourceId)
    expect(store.cellImages[0]?.imageId).toBe(sourceId)

    await store.rotateCellImageCw(0)
    const bakeId = store.cellImages[0]?.imageId
    expect(store.cellImages[0]?.rotation).toBe(90)
    expect(store.cellImages[0]?.sourceImageId).toBe(sourceId)
    expect(bakeId).toBeTruthy()
    expect(bakeId).not.toBe(sourceId)
    const bake = registry.get(bakeId!)
    expect(bake?.derivedFromId).toBe(sourceId)
    expect(bake?.width).toBe(20)
    expect(bake?.height).toBe(40)

    await store.rotateCellImageCw(0)
    const bake2 = store.cellImages[0]?.imageId
    expect(store.cellImages[0]?.rotation).toBe(180)
    expect(bake2).not.toBe(bakeId)
    expect(registry.get(bakeId!)).toBeUndefined()

    store.clearCellImage(0)
    expect(store.cellImages[0]?.imageId).toBeNull()
    expect(store.cellImages[0]?.sourceImageId).toBeNull()
    expect(store.cellImages[0]?.rotation).toBe(0)
    expect(store.cellImages[0]?.flipX).toBe(false)
    expect(store.cellImages[0]?.flipY).toBe(false)
    expect(registry.get(bake2!)).toBeUndefined()
    expect(registry.get(sourceId)).toBeTruthy()
  })

  it('returns display to source on full-turn identity and undoes with re-bake', async () => {
    const store = useCollageStore()
    const registry = useImageRegistry()
    store.setLayout(getTemplate('tpl_single')!)
    const sourceId = seedSource()
    store.assignImage(0, sourceId)
    await store.rotateCellImageCw(0)
    const bake90 = store.cellImages[0]?.imageId
    expect(bake90).not.toBe(sourceId)
    await store.rotateCellImageCw(0)
    await store.rotateCellImageCw(0)
    await store.rotateCellImageCw(0)
    expect(store.cellImages[0]?.rotation).toBe(0)
    expect(store.cellImages[0]?.imageId).toBe(sourceId)
    expect(registry.get(bake90!)).toBeUndefined()

    store.undo()
    await store.syncBakesAfterHistoryChange()
    expect(store.cellImages[0]?.rotation).toBe(270)
    expect(store.cellImages[0]?.sourceImageId).toBe(sourceId)
    const restoredBake = store.cellImages[0]?.imageId
    expect(restoredBake).not.toBe(sourceId)
    expect(registry.get(restoredBake!)?.derivedFromId).toBe(sourceId)
  })

  it('coalesces rapid rotates to a single bake of the latest target', async () => {
    const store = useCollageStore()
    const registry = useImageRegistry()
    store.setLayout(getTemplate('tpl_single')!)
    const sourceId = seedSource()
    store.assignImage(0, sourceId)

    const { bakeOrientedImage } = await import('@/features/images/bakeOrientedImage')
    const bakeMock = bakeOrientedImage as unknown as ReturnType<typeof vi.fn>
    bakeMock.mockClear()

    const p1 = store.rotateCellImageCw(0)
    const p2 = store.rotateCellImageCw(0)
    const p3 = store.rotateCellImageCw(0)
    await Promise.all([p1, p2, p3])

    expect(store.cellImages[0]?.rotation).toBe(270)
    expect(store.cellImages[0]?.sourceImageId).toBe(sourceId)
    expect(store.cellImages[0]?.imageId).not.toBe(sourceId)
    // Only the latest pending orientation is baked (not 90 + 180 + 270).
    expect(bakeMock).toHaveBeenCalledTimes(1)
    expect(registry.derivedIdsOf(sourceId)).toHaveLength(1)
  })

  it('rotate90 then flipH bakes screen-horizontal (270+flipX), not local flipX@90', async () => {
    const store = useCollageStore()
    const registry = useImageRegistry()
    store.setLayout(getTemplate('tpl_single')!)
    const sourceId = seedSource()
    store.assignImage(0, sourceId)

    await store.rotateCellImageCw(0)
    await store.flipCellImageX(0)
    expect(store.cellImages[0]?.rotation).toBe(270)
    expect(store.cellImages[0]?.flipX).toBe(true)
    expect(store.cellImages[0]?.flipY).toBe(false)
    const bakeId = store.cellImages[0]?.imageId
    expect(bakeId).not.toBe(sourceId)
    expect(registry.get(bakeId!)?.bakeTransform).toEqual({
      rotation: 270,
      flipX: true,
      flipY: false,
    })
  })

  it('canonicalizes flipY into rotation×flipX and drops bake on identity', async () => {
    const store = useCollageStore()
    const registry = useImageRegistry()
    store.setLayout(getTemplate('tpl_single')!)
    const sourceId = seedSource()
    store.assignImage(0, sourceId)

    await store.flipCellImageY(0)
    // flipY → canonical (180, flipX)
    expect(store.cellImages[0]?.rotation).toBe(180)
    expect(store.cellImages[0]?.flipX).toBe(true)
    expect(store.cellImages[0]?.flipY).toBe(false)
    const bakeId = store.cellImages[0]?.imageId
    expect(bakeId).not.toBe(sourceId)
    expect(registry.get(bakeId!)?.bakeTransform).toEqual({
      rotation: 180,
      flipX: true,
      flipY: false,
    })

    await store.flipCellImageY(0)
    expect(store.cellImages[0]?.rotation).toBe(0)
    expect(store.cellImages[0]?.flipX).toBe(false)
    expect(store.cellImages[0]?.flipY).toBe(false)
    expect(store.cellImages[0]?.imageId).toBe(sourceId)
    expect(registry.get(bakeId!)).toBeUndefined()
  })

  it('reuses one bake across cells with the same source+canonical', async () => {
    const store = useCollageStore()
    const registry = useImageRegistry()
    store.setLayout(getTemplate('tpl_split_h')!)
    const sourceId = seedSource()
    store.assignImage(0, sourceId)
    store.assignImage(1, sourceId)

    await store.rotateCellImageCw(0)
    const bakeId = store.cellImages[0]?.imageId
    expect(bakeId).not.toBe(sourceId)

    const { bakeOrientedImage } = await import('@/features/images/bakeOrientedImage')
    const bakeMock = bakeOrientedImage as unknown as ReturnType<typeof vi.fn>
    bakeMock.mockClear()

    await store.rotateCellImageCw(1)
    expect(store.cellImages[1]?.imageId).toBe(bakeId)
    expect(bakeMock).not.toHaveBeenCalled()
    expect(registry.derivedIdsOf(sourceId)).toHaveLength(1)
  })
})
