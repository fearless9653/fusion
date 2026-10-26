import { describe, expect, it } from 'vitest'
import { isImageBakeRequest, isImageBakeResponse } from './imageBake.types'
import { buildBakeRequest, parseBakeWorkerResponse } from './bakeImage'
import { orientedOutputSize } from './bakeOrientedCanvas'

describe('image bake message types', () => {
  it('validates bake requests with buffer', () => {
    const buffer = new ArrayBuffer(8)
    expect(
      isImageBakeRequest(
        buildBakeRequest('a', {
          width: 10,
          height: 20,
          rotation: 90,
          flipX: false,
          flipY: false,
          buffer,
          mimeType: 'image/png',
        }),
      ),
    ).toBe(true)
    expect(
      isImageBakeRequest({
        type: 'bake',
        id: 'a',
        width: 10,
        height: 20,
        rotation: 0,
        flipX: false,
        flipY: false,
      }),
    ).toBe(false)
    expect(isImageBakeRequest(null)).toBe(false)
  })

  it('parses worker responses', () => {
    expect(parseBakeWorkerResponse({ type: 'ready' })).toEqual({ type: 'ready' })
    expect(parseBakeWorkerResponse({ type: 'error', id: 'x', message: 'boom' })).toEqual({
      type: 'error',
      id: 'x',
      message: 'boom',
    })
    const buffer = new ArrayBuffer(4)
    expect(
      isImageBakeResponse({
        type: 'baked',
        id: '1',
        width: 10,
        height: 20,
        mimeType: 'image/png',
        buffer,
      }),
    ).toBe(true)
    expect(parseBakeWorkerResponse({ type: 'nope' })).toBeNull()
  })

  it('computes oriented output size without max-edge', () => {
    expect(orientedOutputSize(4000, 2000, 0)).toEqual({ outW: 4000, outH: 2000 })
    expect(orientedOutputSize(4000, 2000, 90)).toEqual({ outW: 2000, outH: 4000 })
    expect(orientedOutputSize(4000, 2000, 270)).toEqual({ outW: 2000, outH: 4000 })
  })
})
