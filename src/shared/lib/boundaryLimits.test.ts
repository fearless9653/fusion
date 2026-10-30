import { describe, expect, it } from 'vitest'
import {
  IMAGE_FILE_MAX_BYTES,
  IMAGE_MAX_EDGE_PX,
  LAYOUT_JSON_MAX_BYTES,
  isLayoutJsonOversize,
  utf8ByteLength,
} from './boundaryLimits'

describe('boundaryLimits', () => {
  it('exposes the agreed soft caps', () => {
    expect(LAYOUT_JSON_MAX_BYTES).toBe(256 * 1024)
    expect(IMAGE_FILE_MAX_BYTES).toBe(40 * 1024 * 1024)
    expect(IMAGE_MAX_EDGE_PX).toBe(8192)
  })

  it('utf8ByteLength counts multi-byte characters', () => {
    expect(utf8ByteLength('abc')).toBe(3)
    expect(utf8ByteLength('拼')).toBe(3)
  })

  it('isLayoutJsonOversize is false at/under the cap', () => {
    expect(isLayoutJsonOversize('x'.repeat(LAYOUT_JSON_MAX_BYTES))).toBe(false)
    expect(isLayoutJsonOversize('x'.repeat(LAYOUT_JSON_MAX_BYTES + 1))).toBe(true)
  })
})
