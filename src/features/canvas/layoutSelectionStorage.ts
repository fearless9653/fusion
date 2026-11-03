/** Persist the currently selected collage layout template id. Independent of style reset. */

import { LAYOUT_STRING_MAX, getTemplate, type LayoutDefinition } from '@/entities/layout'
import { getCustomLayout } from './customLayoutRegistry'

export const SELECTED_LAYOUT_KEY = 'fusion:selected-layout'

/** Read the last selected layout id, or null when unset / invalid. */
export function readSelectedLayoutId(): string | null {
  try {
    const raw = localStorage.getItem(SELECTED_LAYOUT_KEY)
    if (raw === null) return null
    if (typeof raw !== 'string') return null
    const id = raw.trim().slice(0, LAYOUT_STRING_MAX)
    return id.length > 0 ? id : null
  } catch {
    return null
  }
}

/** Persist a layout id (truncated, capped). Empty ids are ignored. */
export function writeSelectedLayoutId(id: string): void {
  const next = id.trim().slice(0, LAYOUT_STRING_MAX)
  if (!next) return
  try {
    localStorage.setItem(SELECTED_LAYOUT_KEY, next)
  } catch {
    // private mode / quota — ignore
  }
}

/**
 * Resolve the persisted selection to a LayoutDefinition.
 * Prefers built-in/catalog registry, then custom layouts. Caller should
 * ensureTemplateCatalog() first when catalog templates may be selected.
 */
export function resolvePersistedLayout(): LayoutDefinition | null {
  const id = readSelectedLayoutId()
  if (!id) return null
  return getTemplate(id) ?? getCustomLayout(id) ?? null
}
