import type { LayoutCell, LayoutGrid } from '@/entities/layout'

/** localStorage key for editor draft autosave (optional UX). */
export const CUSTOM_LAYOUT_DRAFT_KEY = 'fusion:custom-layout-draft'

export type LayoutEditorDraft = {
  schemaVersion: 1
  id: string
  name: string
  grid: LayoutGrid
  cells: LayoutCell[]
  selectedIndex: number | null
  savedAt: string
}

export function writeLayoutEditorDraft(
  draft: Omit<LayoutEditorDraft, 'savedAt' | 'schemaVersion'>,
): void {
  const payload: LayoutEditorDraft = {
    schemaVersion: 1,
    ...draft,
    savedAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(CUSTOM_LAYOUT_DRAFT_KEY, JSON.stringify(payload))
  } catch {
    // Quota / private mode — ignore autosave failure.
  }
}

export function readLayoutEditorDraft(): LayoutEditorDraft | null {
  const raw = localStorage.getItem(CUSTOM_LAYOUT_DRAFT_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as LayoutEditorDraft
    if (parsed?.schemaVersion !== 1) return null
    if (!parsed.grid || !Array.isArray(parsed.cells)) return null
    const rows = Number(parsed.grid.rows)
    const cols = Number(parsed.grid.cols)
    if (!Number.isInteger(rows) || !Number.isInteger(cols)) return null
    if (rows < 1 || rows > 20 || cols < 1 || cols > 20) return null
    return {
      schemaVersion: 1,
      id: typeof parsed.id === 'string' && parsed.id ? parsed.id : `custom_${Date.now()}`,
      name: typeof parsed.name === 'string' && parsed.name ? parsed.name : 'Custom',
      grid: { rows, cols },
      cells: parsed.cells.map((c) => ({
        row: Number(c.row),
        col: Number(c.col),
        rowSpan: Number(c.rowSpan),
        colSpan: Number(c.colSpan),
      })),
      selectedIndex:
        parsed.selectedIndex === null || parsed.selectedIndex === undefined
          ? null
          : Number(parsed.selectedIndex),
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : '',
    }
  } catch {
    return null
  }
}

export function clearLayoutEditorDraft(): void {
  localStorage.removeItem(CUSTOM_LAYOUT_DRAFT_KEY)
}
