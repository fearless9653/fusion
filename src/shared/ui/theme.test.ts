import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyTheme, cycleTheme, readStoredTheme, resolveTheme } from './theme'

function stubScheme(dark: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: dark && String(query).includes('prefers-color-scheme: dark'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
}

describe('theme', () => {
  beforeEach(() => {
    stubScheme(false)
  })

  afterEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    vi.unstubAllGlobals()
  })

  it('defaults to light and cycles light → dark → system → light', () => {
    expect(readStoredTheme()).toBe('light')
    applyTheme('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(readStoredTheme()).toBe('dark')
    expect(cycleTheme('dark')).toBe('system')
    expect(readStoredTheme()).toBe('system')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(cycleTheme('system')).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('resolves system from prefers-color-scheme', () => {
    stubScheme(true)
    expect(resolveTheme('system')).toBe('dark')
    applyTheme('system')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(readStoredTheme()).toBe('system')
  })
})
