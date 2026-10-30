/** Persist collage page sidebar collapse flags (desktop). */

import { readBoolFlag, writeBoolFlag } from '@/shared/utils'

export const SIDEBAR_LEFT_KEY = 'fusion:sidebar-left-collapsed'
export const SIDEBAR_RIGHT_KEY = 'fusion:sidebar-right-collapsed'
export const EDITOR_SIDEBAR_LEFT_KEY = 'fusion:editor-sidebar-left-collapsed'
export const EDITOR_SIDEBAR_RIGHT_KEY = 'fusion:editor-sidebar-right-collapsed'

export function readSidebarCollapsed(key: string, fallback = false): boolean {
  return readBoolFlag(key, fallback)
}

export function writeSidebarCollapsed(key: string, collapsed: boolean): void {
  writeBoolFlag(key, collapsed)
}
