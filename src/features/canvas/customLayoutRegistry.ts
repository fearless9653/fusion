/** Persist user-applied custom LayoutDefinitions for favorites / re-open. */

import type { LayoutDefinition } from '@/entities/layout'
import { safeParseLayoutDefinition } from '@/entities/layout'
import { readFavoriteIds, writeFavoriteIds } from './layoutPickerStorage'

export const CUSTOM_LAYOUTS_KEY = 'fusion:custom-layouts'

function readRawMap(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(CUSTOM_LAYOUTS_KEY)
    if (raw === null) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as Record<string, unknown>
  } catch {
    return {}
  }
}

function writeRawMap(map: Record<string, LayoutDefinition>): void {
  try {
    localStorage.setItem(CUSTOM_LAYOUTS_KEY, JSON.stringify(map))
  } catch {
    // private mode / quota — ignore
  }
}

/** Valid custom layouts keyed by id. Invalid entries are dropped. */
export function readCustomLayoutMap(): Record<string, LayoutDefinition> {
  const raw = readRawMap()
  const out: Record<string, LayoutDefinition> = {}
  for (const [id, value] of Object.entries(raw)) {
    const result = safeParseLayoutDefinition(value)
    if (!result.success) continue
    // Prefer schema id; skip mismatches
    if (result.data.id !== id) continue
    out[id] = result.data
  }
  return out
}

export function getCustomLayout(id: string): LayoutDefinition | null {
  const map = readCustomLayoutMap()
  return map[id] ?? null
}

export function listCustomLayouts(): LayoutDefinition[] {
  return Object.values(readCustomLayoutMap())
}

/** Insert or replace a custom layout by id. Returns the stored definition, or null if invalid. */
export function upsertCustomLayout(layout: LayoutDefinition): LayoutDefinition | null {
  const result = safeParseLayoutDefinition(layout)
  if (!result.success) return null
  const map = readCustomLayoutMap()
  map[result.data.id] = structuredClone(result.data)
  writeRawMap(map)
  return result.data
}

/**
 * Prepend a template id to favorites if not already listed (no duplicates).
 * Existing entries keep relative order after the new head.
 */
export function prependFavoriteId(id: string): string[] {
  if (!id) return readFavoriteIds()
  const current = readFavoriteIds()
  if (current.includes(id)) return current
  const next = [id, ...current]
  writeFavoriteIds(next)
  return next
}

/** Upsert custom layout and ensure it appears at the front of favorites. */
export function rememberAppliedCustomLayout(layout: LayoutDefinition): LayoutDefinition | null {
  const stored = upsertCustomLayout(layout)
  if (!stored) return null
  prependFavoriteId(stored.id)
  return stored
}
