import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  detectBrowserLocale,
  normalizeLocale,
  persistLocale,
  readStoredLocale,
  resolveInitialLocale,
} from './locale'

describe('locale preference', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('detects zh* as zh-CN and others as en', () => {
    vi.stubGlobal('navigator', { language: 'zh-TW' })
    expect(detectBrowserLocale()).toBe('zh-CN')
    vi.stubGlobal('navigator', { language: 'en-US' })
    expect(detectBrowserLocale()).toBe('en')
  })

  it('prefers stored locale over browser', () => {
    vi.stubGlobal('navigator', { language: 'zh-CN' })
    persistLocale('en')
    expect(readStoredLocale()).toBe('en')
    expect(resolveInitialLocale()).toBe('en')
  })

  it('falls back to browser when unset', () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' })
    expect(resolveInitialLocale()).toBe('en')
  })

  it('normalizes unknown values to zh-CN', () => {
    expect(normalizeLocale('en')).toBe('en')
    expect(normalizeLocale('zh-CN')).toBe('zh-CN')
    expect(normalizeLocale('nope')).toBe('zh-CN')
  })
})
