import type { LayoutDefinition } from '@/entities/layout'
import { safeParseLayoutDefinition } from '@/entities/layout'

/** localStorage key for custom-layout → collage handoff (next phase fills writer). */
export const CUSTOM_LAYOUT_HANDOFF_KEY = 'fusion:custom-layout-handoff'

export type CustomLayoutHandoffPayload = {
  layout: LayoutDefinition
  savedAt: string
}

export function writeCustomLayoutHandoff(layout: LayoutDefinition): void {
  const payload: CustomLayoutHandoffPayload = {
    layout,
    savedAt: new Date().toISOString(),
  }
  localStorage.setItem(CUSTOM_LAYOUT_HANDOFF_KEY, JSON.stringify(payload))
}

export function readCustomLayoutHandoff(): LayoutDefinition | null {
  const raw = localStorage.getItem(CUSTOM_LAYOUT_HANDOFF_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as CustomLayoutHandoffPayload
    const result = safeParseLayoutDefinition(parsed.layout)
    if (!result.success) return null
    return result.data
  } catch {
    return null
  }
}

export function clearCustomLayoutHandoff(): void {
  localStorage.removeItem(CUSTOM_LAYOUT_HANDOFF_KEY)
}
