import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getTemplate } from '@/entities/layout'

let bakeGate: Promise<void> = Promise.resolve()

vi.mock('@/features/images/bakeOrientedImage', async () => {
  const actual = await vi.importActual<typeof import('@/features/images/bakeOrientedImage')>(
    '@/features/images/bakeOrientedImage',
  )
  return {
    ...actual,
    bakeOrientedImage: vi.fn(async (source: { width: number; height: number }, transform) => {
      await bakeGate
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

function seedSource(): string {
  const registry = useImageRegistry()
  const id = 'src_race'
  const next = new Map(registry.images)
  next.set(id, {
    id,
    name: 'cell.png',
    objectUrl: 'blob:test-cell',
    bitmap: null,
    width: 40,
    height: 20,
    mimeType: 'image/png',
    derivedFromId: null,
    bakeTransform: null,
  })
  registry.images = next
  return id
}

describe('orientation bake mid-flight clicks', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock-bake'),
      revokeObjectURL: vi.fn(),
    })
    setActivePinia(createPinia())
    useImageRegistry().reset()
    useCollageStore().resetSession()
    setOrientationBakeCoalesceMsForTests(0)
    bakeGate = Promise.resolve()
  })

  afterEach(() => {
    setOrientationBakeCoalesceMsForTests(null)
  })

  it('second rotate during in-flight bake reaches 180 not 90', async () => {
    const store = useCollageStore()
    store.setLayout(getTemplate('tpl_single')!)
    store.assignImage(0, seedSource())

    let resolveGate!: () => void
    bakeGate = new Promise<void>((r) => {
      resolveGate = r
    })

    const p1 = store.rotateCellImageCw(0)
    await new Promise((r) => setTimeout(r, 10))
    const p2 = store.rotateCellImageCw(0)
    resolveGate()
    await Promise.all([p1, p2])

    expect(store.cellImages[0]?.rotation).toBe(180)
  })

  it('flipH during in-flight rotate90 yields screen-H canonical 270+flipX', async () => {
    const store = useCollageStore()
    store.setLayout(getTemplate('tpl_single')!)
    store.assignImage(0, seedSource())

    let resolveGate!: () => void
    bakeGate = new Promise<void>((r) => {
      resolveGate = r
    })

    const p1 = store.rotateCellImageCw(0)
    await new Promise((r) => setTimeout(r, 10))
    const p2 = store.flipCellImageX(0)
    resolveGate()
    await Promise.all([p1, p2])

    expect(store.cellImages[0]?.rotation).toBe(270)
    expect(store.cellImages[0]?.flipX).toBe(true)
    expect(store.cellImages[0]?.flipY).toBe(false)
  })
})
