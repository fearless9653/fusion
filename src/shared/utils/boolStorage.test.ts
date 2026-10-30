import { beforeEach, describe, expect, it } from 'vitest'
import { readBoolFlag, writeBoolFlag } from './boolStorage'

describe('boolStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to fallback when unset', () => {
    expect(readBoolFlag('fusion:test-flag', false)).toBe(false)
    expect(readBoolFlag('fusion:test-flag', true)).toBe(true)
  })

  it('round-trips boolean flags', () => {
    writeBoolFlag('fusion:test-flag', true)
    expect(readBoolFlag('fusion:test-flag', false)).toBe(true)
    writeBoolFlag('fusion:test-flag', false)
    expect(readBoolFlag('fusion:test-flag', true)).toBe(false)
  })

  it('treats legacy "true" as true', () => {
    localStorage.setItem('fusion:test-flag', 'true')
    expect(readBoolFlag('fusion:test-flag', false)).toBe(true)
  })
})
