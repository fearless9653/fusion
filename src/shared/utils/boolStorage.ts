/** Read/write boolean flags in localStorage as '1' / '0' (also accepts legacy 'true'). */

export function readBoolFlag(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return raw === '1' || raw === 'true'
  } catch {
    return fallback
  }
}

export function writeBoolFlag(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? '1' : '0')
  } catch {
    // private mode / quota — ignore
  }
}
