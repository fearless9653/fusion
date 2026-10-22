const STORAGE_KEY = 'fusion:locale'

export type AppLocale = 'zh-CN' | 'en'

export function detectBrowserLocale(): AppLocale {
  try {
    const lang = (navigator.language || '').toLowerCase()
    if (lang.startsWith('zh')) return 'zh-CN'
  } catch {
    // ignore
  }
  return 'en'
}

/** Saved preference, or null if unset. */
export function readStoredLocale(): AppLocale | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'en' || v === 'zh-CN') return v
  } catch {
    // ignore
  }
  return null
}

/** Persisted choice wins; otherwise navigator.language. */
export function resolveInitialLocale(): AppLocale {
  return readStoredLocale() ?? detectBrowserLocale()
}

export function persistLocale(locale: AppLocale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // ignore quota / private mode
  }
}

export function normalizeLocale(value: string): AppLocale {
  return value === 'en' ? 'en' : 'zh-CN'
}
