import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./bakeOrientedImage', async () => {
  const actual = await vi.importActual<typeof import('./bakeOrientedImage')>('./bakeOrientedImage')
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

import { useImageRegistry } from './imageRegistry'

function seedSource(
  registry: ReturnType<typeof useImageRegistry>,
  width = 32,
  height = 16,
): string {
  const id = 'src_test_1'
  const entry = {
    id,
    name: 'seed.png',
    objectUrl: 'blob:test-source',
    bitmap: null,
    width,
    height,
    mimeType: 'image/png',
    derivedFromId: null,
    bakeTransform: null,
  }
  const next = new Map(registry.images)
  next.set(id, entry)
  registry.images = next
  return id
}

describe('imageRegistry orientation bake', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock-bake'),
      revokeObjectURL: vi.fn(),
    })
    setActivePinia(createPinia())
    useImageRegistry().reset()
  })

  it('adds a derived bake and cascades remove from source', async () => {
    const registry = useImageRegistry()
    const sourceId = seedSource(registry)
    const bake = await registry.addBakedFrom(sourceId, { rotation: 90, flipX: false, flipY: false })
    expect(bake.derivedFromId).toBe(sourceId)
    expect(bake.width).toBe(16)
    expect(bake.height).toBe(32)
    expect(registry.get(bake.id)).toBeTruthy()
    registry.remove(sourceId)
    expect(registry.get(sourceId)).toBeUndefined()
    expect(registry.get(bake.id)).toBeUndefined()
  })

  it('refuses identity bake', async () => {
    const registry = useImageRegistry()
    const sourceId = seedSource(registry)
    await expect(registry.addBakedFrom(sourceId, { rotation: 0 })).rejects.toThrow(/identity/i)
  })

  it('reuses existing derived for same source+canonical', async () => {
    const registry = useImageRegistry()
    const sourceId = seedSource(registry)
    const a = await registry.addBakedFrom(sourceId, { rotation: 90, flipY: true })
    // flipY+90 → canonical 270+flipX
    expect(a.bakeTransform).toEqual({ rotation: 270, flipX: true, flipY: false })
    const b = await registry.addBakedFrom(sourceId, { rotation: 270, flipX: true })
    expect(b.id).toBe(a.id)
    expect(registry.derivedIdsOf(sourceId)).toHaveLength(1)
  })
})
