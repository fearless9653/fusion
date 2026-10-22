/** Persist collage page sidebar collapse flags (desktop). */

export const SIDEBAR_LEFT_KEY = 'fusion:sidebar-left-collapsed'
export const SIDEBAR_RIGHT_KEY = 'fusion:sidebar-right-collapsed'
export const EDITOR_SIDEBAR_LEFT_KEY = 'fusion:editor-sidebar-left-collapsed'
export const EDITOR_SIDEBAR_RIGHT_KEY = 'fusion:editor-sidebar-right-collapsed'

export function readSidebarCollapsed(key: string, fallback = false): boolean {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return raw === '1' || raw === 'true'
  } catch {
    return fallback
  }
}

export function writeSidebarCollapsed(key: string, collapsed: boolean): void {
  try {
    localStorage.setItem(key, collapsed ? '1' : '0')
  } catch {
    // private mode / quota — ignore
  }
}
