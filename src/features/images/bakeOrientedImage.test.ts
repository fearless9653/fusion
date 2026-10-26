import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { bakeOrientedImage, isIdentityOrientation } from './bakeOrientedImage'
import { resetBakeImageClient } from '@/shared/workers'

describe('isIdentityOrientation', () => {
  it('detects identity and non-identity', () => {
    expect(isIdentityOrientation(null)).toBe(true)
    expect(isIdentityOrientation({ rotation: 0, flipX: false, flipY: false })).toBe(true)
    expect(isIdentityOrientation({ rotation: 90 })).toBe(false)
    expect(isIdentityOrientation({ flipX: true })).toBe(false)
  })
})

describe('bakeOrientedImage', () => {
  const drawImage = vi.fn()
  const rotate = vi.fn()
  const scale = vi.fn()
  const translate = vi.fn()
  const save = vi.fn()
  const restore = vi.fn()

  beforeEach(() => {
    resetBakeImageClient()
    drawImage.mockClear()
    rotate.mockClear()
    scale.mockClear()
    translate.mockClear()
    const ctx = { drawImage, rotate, scale, translate, save, restore }
    // Force main-thread fallback so canvas stubs apply.
    vi.stubGlobal('Worker', undefined)
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        width: number
        height: number
        constructor(width: number, height: number) {
          this.width = width
          this.height = height
        }
        getContext() {
          return ctx
        }
        convertToBlob() {
          return Promise.resolve(
            new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }),
          )
        }
      },
    )
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async (source: { width?: number; height?: number }) => ({
        width: source.width ?? 1,
        height: source.height ?? 1,
        close: vi.fn(),
      })),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    resetBakeImageClient()
  })

  it('keeps size for 180 and swaps for 90', async () => {
    const bitmap = { width: 40, height: 20, close: vi.fn() } as unknown as ImageBitmap
    const baked180 = await bakeOrientedImage(
      { bitmap, width: 40, height: 20 },
      { rotation: 180, flipX: false, flipY: false },
    )
    expect(baked180.width).toBe(40)
    expect(baked180.height).toBe(20)
    expect(baked180.blob.type).toBe('image/png')
    expect(rotate).toHaveBeenCalledWith(Math.PI)

    rotate.mockClear()
    const baked90 = await bakeOrientedImage(
      { bitmap, width: 40, height: 20 },
      { rotation: 90, flipX: false, flipY: false },
    )
    expect(baked90.width).toBe(20)
    expect(baked90.height).toBe(40)
    expect(rotate).toHaveBeenCalledWith(Math.PI / 2)
    expect(drawImage).toHaveBeenCalled()
  })

  it('applies flipX without changing dimensions', async () => {
    const bitmap = { width: 16, height: 16, close: vi.fn() } as unknown as ImageBitmap
    const baked = await bakeOrientedImage(
      { bitmap, width: 16, height: 16 },
      { rotation: 0, flipX: true, flipY: false },
    )
    expect(baked.width).toBe(16)
    expect(baked.height).toBe(16)
    expect(scale).toHaveBeenCalledWith(-1, 1)
  })

  it('canonicalizes flipX+flipY into rotate 180 with no scale flip', async () => {
    const bitmap = { width: 16, height: 16, close: vi.fn() } as unknown as ImageBitmap
    scale.mockClear()
    rotate.mockClear()
    const baked = await bakeOrientedImage(
      { bitmap, width: 16, height: 16 },
      { rotation: 0, flipX: true, flipY: true },
    )
    expect(baked.width).toBe(16)
    expect(baked.height).toBe(16)
    expect(scale).toHaveBeenCalledWith(1, 1)
    expect(rotate).toHaveBeenCalledWith(Math.PI)
  })
})
