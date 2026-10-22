import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { LayoutCell, LayoutDefinition, LayoutOpFailure } from '@/entities/layout'
import {
  addCell,
  autoFillEmptyCells,
  createEmptyGridCells,
  isFullCoverage,
  moveCell,
  removeCell,
  resizeCell,
  safeParseLayoutDefinition,
  withSyncedImageCount,
} from '@/entities/layout'
import {
  clearLayoutEditorDraft,
  readLayoutEditorDraft,
  writeLayoutEditorDraft,
} from './draftStorage'
import { rememberAppliedCustomLayout } from '@/features/canvas/customLayoutRegistry'
import { writeCustomLayoutHandoff } from './handoff'
import { normalizeLayoutJsonText } from './jsonText'

export const DEFAULT_EDITOR_ROWS = 6
export const DEFAULT_EDITOR_COLS = 6
export const MIN_GRID = 1
export const MAX_GRID = 20

function clampGrid(n: number): number {
  if (!Number.isFinite(n)) return MIN_GRID
  return Math.min(MAX_GRID, Math.max(MIN_GRID, Math.trunc(n)))
}

function newLayoutId(): string {
  return `custom_${Date.now()}`
}

function formatZodIssues(
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
): string[] {
  return issues.map((issue) => {
    const path = issue.path.map(String).join('.')
    return path ? `${path}: ${issue.message}` : issue.message
  })
}

export const useLayoutEditorStore = defineStore('layoutEditor', () => {
  const rows = ref(DEFAULT_EDITOR_ROWS)
  const cols = ref(DEFAULT_EDITOR_COLS)
  const cells = ref<LayoutCell[]>([])
  const selectedIndex = ref<number | null>(null)
  const id = ref(newLayoutId())
  const name = ref('Custom')
  const lastOpError = ref<string | null>(null)
  const validationErrors = ref<string[]>([])

  const layout = computed<LayoutDefinition>(() =>
    withSyncedImageCount({
      schemaVersion: 1,
      id: id.value,
      name: name.value || 'Custom',
      imageCount: cells.value.length,
      grid: { rows: rows.value, cols: cols.value },
      cells: cells.value,
    }),
  )

  const jsonPreview = computed(() => JSON.stringify(layout.value, null, 2))

  const fullCoverage = computed(() => isFullCoverage(layout.value))

  const coverageUnits = computed(() =>
    cells.value.reduce((sum, c) => sum + c.rowSpan * c.colSpan, 0),
  )

  const totalUnits = computed(() => rows.value * cols.value)

  const canUseLayout = computed(() => fullCoverage.value)

  function persistDraft(): void {
    writeLayoutEditorDraft({
      id: id.value,
      name: name.value,
      grid: { rows: rows.value, cols: cols.value },
      cells: cells.value.map((c) => ({ ...c })),
      selectedIndex: selectedIndex.value,
    })
  }

  function applyCells(next: LayoutCell[], select: number | null = selectedIndex.value): void {
    cells.value = next.map((c) => ({ ...c }))
    if (select !== null && (select < 0 || select >= cells.value.length)) {
      selectedIndex.value = null
    } else {
      selectedIndex.value = select
    }
    lastOpError.value = null
    validationErrors.value = []
    persistDraft()
  }

  function rejectOp(failure: LayoutOpFailure): false {
    lastOpError.value = failure.message
    return false
  }

  function initGrid(nextRows: number, nextCols: number): void {
    rows.value = clampGrid(nextRows)
    cols.value = clampGrid(nextCols)
    id.value = newLayoutId()
    name.value = `Custom ${rows.value}×${cols.value}`
    applyCells(createEmptyGridCells(rows.value, cols.value), null)
  }

  function setName(value: string): void {
    name.value = value.trim() || 'Custom'
    persistDraft()
  }

  function selectBlock(index: number | null): void {
    if (index === null) {
      selectedIndex.value = null
      persistDraft()
      return
    }
    if (index < 0 || index >= cells.value.length) {
      selectedIndex.value = null
      persistDraft()
      return
    }
    selectedIndex.value = index
    lastOpError.value = null
    persistDraft()
  }

  /** Click empty unit square → add 1×1 block and select it. */
  function addUnitAt(row: number, col: number): boolean {
    const result = addCell({ rows: rows.value, cols: cols.value }, cells.value, {
      row,
      col,
      rowSpan: 1,
      colSpan: 1,
    })
    if (!result.ok) return rejectOp(result)
    applyCells(result.cells, result.cells.length - 1)
    return true
  }

  function deleteSelected(): boolean {
    if (selectedIndex.value === null) {
      lastOpError.value = 'No block selected'
      return false
    }
    const result = removeCell(cells.value, selectedIndex.value)
    if (!result.ok) return rejectOp(result)
    applyCells(result.cells, null)
    return true
  }

  function moveSelected(toRow: number, toCol: number): boolean {
    if (selectedIndex.value === null) {
      lastOpError.value = 'No block selected'
      return false
    }
    const result = moveCell(
      { rows: rows.value, cols: cols.value },
      cells.value,
      selectedIndex.value,
      { row: toRow, col: toCol },
    )
    if (!result.ok) return rejectOp(result)
    applyCells(result.cells, selectedIndex.value)
    return true
  }

  function resizeSelected(rowSpan: number, colSpan: number): boolean {
    if (selectedIndex.value === null) {
      lastOpError.value = 'No block selected'
      return false
    }
    const result = resizeCell(
      { rows: rows.value, cols: cols.value },
      cells.value,
      selectedIndex.value,
      { rowSpan, colSpan },
    )
    if (!result.ok) return rejectOp(result)
    applyCells(result.cells, selectedIndex.value)
    return true
  }

  function autoFill(): void {
    const next = autoFillEmptyCells({ rows: rows.value, cols: cols.value }, cells.value)
    applyCells(next, selectedIndex.value)
  }

  function resetLayout(): void {
    applyCells(createEmptyGridCells(rows.value, cols.value), null)
    lastOpError.value = null
    validationErrors.value = []
  }

  function importJson(text: string): boolean {
    const normalized = normalizeLayoutJsonText(text)
    if (!normalized) {
      validationErrors.value = ['JSON text is empty']
      lastOpError.value = 'JSON text is empty'
      return false
    }
    let raw: unknown
    try {
      raw = JSON.parse(normalized)
      // Allow double-encoded JSON strings
      if (typeof raw === 'string') raw = JSON.parse(raw)
    } catch {
      validationErrors.value = ['Invalid JSON']
      lastOpError.value = 'Invalid JSON'
      return false
    }
    const parsed = safeParseLayoutDefinition(raw)
    if (!parsed.success) {
      validationErrors.value = formatZodIssues(parsed.error.issues)
      lastOpError.value = 'Layout validation failed'
      return false
    }
    const data = parsed.data as LayoutDefinition
    rows.value = data.grid.rows
    cols.value = data.grid.cols
    id.value = data.id
    name.value = data.name
    applyCells(
      data.cells.map((c) => ({ ...c })),
      null,
    )
    validationErrors.value = []
    lastOpError.value = null
    return true
  }

  function clearValidation(): void {
    validationErrors.value = []
    lastOpError.value = null
  }

  /**
   * Persist handoff for CollagePage when coverage is complete.
   * Caller navigates to `/`.
   */
  function useThisLayout(): LayoutDefinition | null {
    const def = layout.value
    if (!isFullCoverage(def)) {
      lastOpError.value = 'Layout must fully cover the grid before use'
      return null
    }
    rememberAppliedCustomLayout(def)
    writeCustomLayoutHandoff(def)
    clearLayoutEditorDraft()
    return def
  }

  function loadDraftOrDefault(): void {
    const draft = readLayoutEditorDraft()
    if (!draft) {
      initGrid(DEFAULT_EDITOR_ROWS, DEFAULT_EDITOR_COLS)
      return
    }
    rows.value = clampGrid(draft.grid.rows)
    cols.value = clampGrid(draft.grid.cols)
    id.value = draft.id
    name.value = draft.name
    cells.value = draft.cells.map((c) => ({ ...c }))
    const sel = draft.selectedIndex
    selectedIndex.value = sel !== null && sel >= 0 && sel < cells.value.length ? sel : null
    lastOpError.value = null
    validationErrors.value = []
  }

  function clearDraft(): void {
    clearLayoutEditorDraft()
  }

  return {
    rows,
    cols,
    cells,
    selectedIndex,
    id,
    name,
    lastOpError,
    validationErrors,
    layout,
    jsonPreview,
    fullCoverage,
    coverageUnits,
    totalUnits,
    canUseLayout,
    initGrid,
    setName,
    selectBlock,
    addUnitAt,
    deleteSelected,
    moveSelected,
    resizeSelected,
    autoFill,
    resetLayout,
    importJson,
    clearValidation,
    useThisLayout,
    loadDraftOrDefault,
    clearDraft,
    persistDraft,
  }
})
