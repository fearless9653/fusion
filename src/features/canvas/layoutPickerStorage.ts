/** Persist layout picker group expand state and favorite template order. */

export const LAYOUT_GROUPS_EXPANDED_KEY = 'fusion:layout-groups-expanded'
export const LAYOUT_FAVORITES_KEY = 'fusion:layout-favorites'

/**
 * Expanded imageCount groups. When the key is unset, every known count is expanded.
 * Stored value is a JSON number[].
 */
export function readExpandedGroupCounts(allCounts: readonly number[]): number[] {
  const allowed = new Set(allCounts)
  try {
    const raw = localStorage.getItem(LAYOUT_GROUPS_EXPANDED_KEY)
    if (raw === null) return allCounts.filter((n) => Number.isFinite(n))
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return allCounts.filter((n) => Number.isFinite(n))
    return parsed.filter((n): n is number => typeof n === 'number' && allowed.has(n))
  } catch {
    return allCounts.filter((n) => Number.isFinite(n))
  }
}

export function writeExpandedGroupCounts(counts: readonly number[]): void {
  try {
    localStorage.setItem(LAYOUT_GROUPS_EXPANDED_KEY, JSON.stringify([...counts]))
  } catch {
    // private mode / quota — ignore
  }
}

/** Favorite template ids in display order. */
export function readFavoriteIds(): string[] {
  try {
    const raw = localStorage.getItem(LAYOUT_FAVORITES_KEY)
    if (raw === null) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0)
  } catch {
    return []
  }
}

export function writeFavoriteIds(ids: readonly string[]): void {
  try {
    localStorage.setItem(LAYOUT_FAVORITES_KEY, JSON.stringify([...ids]))
  } catch {
    // private mode / quota — ignore
  }
}
