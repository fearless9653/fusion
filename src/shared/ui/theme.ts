const STORAGE_KEY = 'fusion:theme'

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const CYCLE: ThemeMode[] = ['light', 'dark', 'system']

let mediaCleanup: (() => void) | null = null

export function readStoredTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'dark' || v === 'system' || v === 'light') return v
    return 'light'
  } catch {
    return 'light'
  }
}

export function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return mode
}

function persistTheme(mode: ThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // ignore quota / private mode
  }
}

function bindSystemListener(mode: ThemeMode): void {
  mediaCleanup?.()
  mediaCleanup = null
  if (mode !== 'system' || typeof window === 'undefined') return
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const onChange = (): void => {
    document.documentElement.dataset.theme = resolveTheme('system')
  }
  mq.addEventListener('change', onChange)
  mediaCleanup = () => mq.removeEventListener('change', onChange)
}

/** Persist preference and set `data-theme` to the resolved light/dark value. */
export function applyTheme(mode: ThemeMode): void {
  persistTheme(mode)
  document.documentElement.dataset.theme = resolveTheme(mode)
  bindSystemListener(mode)
}

/** Cycle light → dark → system → light. */
export function cycleTheme(current: ThemeMode): ThemeMode {
  const i = CYCLE.indexOf(current)
  const next = CYCLE[(i + 1) % CYCLE.length]!
  applyTheme(next)
  return next
}
