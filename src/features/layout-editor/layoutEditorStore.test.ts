import { LAYOUT_STRING_MAX } from '@/entities/layout'
import { LAYOUT_JSON_MAX_BYTES } from '@/shared/lib/boundaryLimits'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { createUnitGridCells, isFullCoverage } from '@/entities/layout'
import {
  CUSTOM_LAYOUT_DRAFT_KEY,
  CUSTOM_LAYOUT_HANDOFF_KEY,
  clearCustomLayoutHandoff,
  readCustomLayoutHandoff,
  useLayoutEditorStore,
} from './index'

describe('useLayoutEditorStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('inits empty grid and rejects overlapping add', () => {
    const store = useLayoutEditorStore()
    store.initGrid(3, 3)
    expect(store.rows).toBe(3)
    expect(store.cols).toBe(3)
    expect(store.cells).toHaveLength(0)
    expect(store.fullCoverage).toBe(false)

    expect(store.addUnitAt(0, 0)).toBe(true)
    expect(store.cells).toHaveLength(1)
    expect(store.selectedIndex).toBe(0)
    expect(store.addUnitAt(0, 0)).toBe(false)
    expect(store.cells).toHaveLength(1)
    expect(store.lastOpError).toMatch(/overlap/i)
  })

  it('selects, moves, resizes with collision rejection, and deletes', () => {
    const store = useLayoutEditorStore()
    store.initGrid(4, 4)
    store.addUnitAt(0, 0)
    store.addUnitAt(0, 2)
    store.selectBlock(0)

    expect(store.moveSelected(0, 1)).toBe(true)
    expect(store.cells[0]).toMatchObject({ row: 0, col: 1 })

    // Overlap with block at (0,2)
    expect(store.moveSelected(0, 2)).toBe(false)
    expect(store.cells[0]).toMatchObject({ row: 0, col: 1 })

    expect(store.resizeSelected(2, 1)).toBe(true)
    expect(store.cells[0]).toMatchObject({ rowSpan: 2, colSpan: 1 })

    // Grow into neighbor → reject
    expect(store.resizeSelected(1, 2)).toBe(false)
    expect(store.cells[0]?.colSpan).toBe(1)

    expect(store.deleteSelected()).toBe(true)
    expect(store.cells).toHaveLength(1)
    expect(store.selectedIndex).toBeNull()
  })

  it('auto-fills to full coverage and enables useThisLayout handoff', () => {
    const store = useLayoutEditorStore()
    store.initGrid(2, 2)
    store.addUnitAt(0, 0)
    store.autoFill()
    expect(store.cells).toHaveLength(4)
    expect(store.fullCoverage).toBe(true)
    expect(store.canUseLayout).toBe(true)

    const used = store.useThisLayout()
    expect(used).not.toBeNull()
    expect(isFullCoverage(used!)).toBe(true)
    expect(readCustomLayoutHandoff()?.id).toBe(used!.id)
    expect(localStorage.getItem(CUSTOM_LAYOUT_DRAFT_KEY)).toBeNull()
    clearCustomLayoutHandoff()
    expect(localStorage.getItem(CUSTOM_LAYOUT_HANDOFF_KEY)).toBeNull()
  })

  it('blocks useThisLayout when coverage is incomplete', () => {
    const store = useLayoutEditorStore()
    store.initGrid(2, 2)
    store.addUnitAt(0, 0)
    expect(store.useThisLayout()).toBeNull()
    expect(readCustomLayoutHandoff()).toBeNull()
    expect(store.lastOpError).toMatch(/fully cover/i)
  })

  it('round-trips jsonPreview through importJson after grid edits', () => {
    const store = useLayoutEditorStore()
    store.initGrid(2, 2)
    store.autoFill()
    expect(store.cells).toHaveLength(4)
    const snapshot = store.jsonPreview
    store.resetLayout()
    expect(store.cells).toHaveLength(0)
    // Stale empty preview must fail (the old paste-buffer footgun)
    expect(store.importJson(store.jsonPreview)).toBe(false)
    expect(store.validationErrors.some((e) => e.includes('cells'))).toBe(true)
    // Applying the earlier live snapshot succeeds (Import / synced Apply path)
    expect(store.importJson(snapshot)).toBe(true)
    expect(store.cells).toHaveLength(4)
    expect(store.fullCoverage).toBe(true)
  })

  it('importJson accepts BOM and markdown-fenced payloads', () => {
    const store = useLayoutEditorStore()
    const ok = {
      schemaVersion: 1,
      id: 'fenced',
      name: 'Fenced',
      imageCount: 1,
      grid: { rows: 1, cols: 1 },
      cells: [{ row: 0, col: 0, rowSpan: 1, colSpan: 1 }],
    }
    const body = JSON.stringify(ok)
    expect(store.importJson('\uFEFF' + body)).toBe(true)
    expect(store.id).toBe('fenced')
    store.resetLayout()
    expect(store.importJson('```json\n' + body + '\n```')).toBe(true)
    expect(store.cells).toHaveLength(1)
  })

  it('imports valid JSON and surfaces zod errors for invalid', () => {
    const store = useLayoutEditorStore()
    store.initGrid(2, 2)
    const ok = {
      schemaVersion: 1,
      id: 'imported',
      name: 'Imported',
      imageCount: 4,
      grid: { rows: 2, cols: 2 },
      cells: createUnitGridCells(2, 2),
    }
    expect(store.importJson(JSON.stringify(ok))).toBe(true)
    expect(store.id).toBe('imported')
    expect(store.cells).toHaveLength(4)
    expect(store.fullCoverage).toBe(true)

    expect(store.importJson('{bad')).toBe(false)
    expect(store.validationErrors[0]).toMatch(/Invalid JSON/)

    expect(
      store.importJson(
        JSON.stringify({
          schemaVersion: 1,
          id: 'bad',
          name: 'Bad',
          imageCount: 1,
          grid: { rows: 2, cols: 2 },
          cells: [{ row: 0, col: 0, rowSpan: 3, colSpan: 1 }],
        }),
      ),
    ).toBe(false)
    expect(store.validationErrors.length).toBeGreaterThan(0)
  })

  it('setName truncates to LAYOUT_STRING_MAX after trim', () => {
    const store = useLayoutEditorStore()
    store.setName('  ' + 'A'.repeat(80) + '  ')
    expect(store.name.length).toBe(LAYOUT_STRING_MAX)
    expect(store.name).toBe('A'.repeat(LAYOUT_STRING_MAX))
    store.setName('   ')
    expect(store.name).toBe('Custom')
  })

  it('autosaves draft and restores via loadDraftOrDefault', () => {
    const store = useLayoutEditorStore()
    store.initGrid(5, 5)
    store.addUnitAt(1, 1)
    store.setName('Drafty')
    expect(localStorage.getItem(CUSTOM_LAYOUT_DRAFT_KEY)).toBeTruthy()

    setActivePinia(createPinia())
    const restored = useLayoutEditorStore()
    restored.loadDraftOrDefault()
    expect(restored.rows).toBe(5)
    expect(restored.cols).toBe(5)
    expect(restored.name).toBe('Drafty')
    expect(restored.cells).toHaveLength(1)
    expect(restored.cells[0]).toMatchObject({ row: 1, col: 1 })
  })

  it('reset clears cells but keeps grid size', () => {
    const store = useLayoutEditorStore()
    store.initGrid(3, 4)
    store.autoFill()
    expect(store.cells.length).toBeGreaterThan(0)
    store.resetLayout()
    expect(store.rows).toBe(3)
    expect(store.cols).toBe(4)
    expect(store.cells).toHaveLength(0)
    expect(store.selectedIndex).toBeNull()
  })
  it('rejects JSON over the soft byte cap before parse', () => {
    const store = useLayoutEditorStore()
    store.initGrid(2, 2)
    const huge = '{"x":"' + 'a'.repeat(LAYOUT_JSON_MAX_BYTES) + '"}'
    expect(store.importJson(huge)).toBe(false)
    expect(store.lastOpError).toMatch(/256 KiB/)
    expect(store.validationErrors[0]).toMatch(/256 KiB/)
  })
})
