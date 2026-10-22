import { describe, expect, it } from 'vitest'
import { isImageDecodeRequest, isImageDecodeResponse } from './imageDecode.types'
import { buildDecodeRequest, parseWorkerResponse } from './decodeImage'

describe('image decode message types', () => {
  it('validates decode requests', () => {
    const buffer = new ArrayBuffer(8)
    expect(isImageDecodeRequest(buildDecodeRequest('a', buffer, 'image/png'))).toBe(true)
    expect(isImageDecodeRequest({ type: 'decode', id: 'a' })).toBe(false)
    expect(isImageDecodeRequest(null)).toBe(false)
  })

  it('parses worker responses', () => {
    expect(parseWorkerResponse({ type: 'ready' })).toEqual({ type: 'ready' })
    expect(parseWorkerResponse({ type: 'error', id: 'x', message: 'boom' })).toEqual({
      type: 'error',
      id: 'x',
      message: 'boom',
    })
    expect(isImageDecodeResponse({ type: 'decoded', id: '1', width: 10, height: 20 })).toBe(true)
    expect(parseWorkerResponse({ type: 'nope' })).toBeNull()
  })
})
