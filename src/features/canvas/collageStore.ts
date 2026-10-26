import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { LayoutDefinition } from '@/entities/layout'
import { isFullCoverage, parseLayoutDefinition } from '@/entities/layout'
import type {
  AspectSource,
  CellImagePosition,
  CollageSessionState,
  CollageStyle,
  DownloadQuality,
} from '@/entities/session'
import {
  DEFAULT_STYLE,
  canRedo,
  canUndo,
  createDefaultSessionState,
  clampCellScale,
  createEmptyCellImages,
  createEqualFractions,
  createHistoryStack,
  pushHistory,
  redoHistory,
  undoHistory,
} from '@/entities/session'
import type { HistoryStack } from '@/entities/session'
import { normalizeFractions, redistributeAdjacent } from '@/shared/lib'
import { rememberAppliedCustomLayout } from './customLayoutRegistry'

function cloneSession(state: CollageSessionState): CollageSessionState {
  // JSON round-trip: session is serializable and may be a Vue reactive proxy.
  return JSON.parse(JSON.stringify(state)) as CollageSessionState
}

function resizeCellImages(
  previous: CollageSessionState['cellImages'],
  count: number,
): CollageSessionState['cellImages'] {
  const next = createEmptyCellImages(count)
  for (let i = 0; i < Math.min(previous.length, count); i += 1) {
    const prev = structuredClone(previous[i]!)
    prev.scale = clampCellScale(prev.scale)
    next[i] = prev
  }
  return next
}

function resetFractionsForLayout(draft: CollageSessionState, layout: LayoutDefinition): void {
  draft.rowFractions = createEqualFractions(layout.grid.rows)
  draft.colFractions = createEqualFractions(layout.grid.cols)
}

export const useCollageStore = defineStore('collage', () => {
  const history = ref<HistoryStack<CollageSessionState>>(
    createHistoryStack(createDefaultSessionState()),
  )

  /** On-screen collage frame CSS px (not in undo history). Used to scale export style. */
  const previewFrameSize = ref<{ width: number; height: number }>({ width: 0, height: 0 })

  function setPreviewFrameSize(width: number, height: number): void {
    const w = Math.max(0, width)
    const h = Math.max(0, height)
    if (previewFrameSize.value.width === w && previewFrameSize.value.height === h) return
    previewFrameSize.value = { width: w, height: h }
  }

  const session = computed(() => history.value.present)
  const layout = computed(() => session.value.layout)
  const style = computed(() => session.value.style)
  const cellImages = computed(() => session.value.cellImages)
  const rowFractions = computed(() => session.value.rowFractions)
  const colFractions = computed(() => session.value.colFractions)
  const selectedCellIndex = computed(() => session.value.selectedCellIndex)
  const undoAvailable = computed(() => canUndo(history.value))
  const redoAvailable = computed(() => canRedo(history.value))

  function commit(next: CollageSessionState): void {
    history.value = pushHistory(history.value, cloneSession(next))
  }

  function patchPresent(mutator: (draft: CollageSessionState) => void): void {
    const draft = cloneSession(session.value)
    mutator(draft)
    commit(draft)
  }

  function setLayout(definition: LayoutDefinition): void {
    const parsed = parseLayoutDefinition(definition)
    patchPresent((draft) => {
      draft.layout = parsed
      draft.cellImages = resizeCellImages(draft.cellImages, parsed.cells.length)
      resetFractionsForLayout(draft, parsed)
      if (draft.selectedCellIndex !== null && draft.selectedCellIndex >= parsed.cells.length) {
        draft.selectedCellIndex = null
      }
    })
  }

  /**
   * Apply a custom layout after editor handoff.
   * Requires full coverage (SPEC §4.2).
   */
  function applyCustomLayout(definition: LayoutDefinition): void {
    const parsed = parseLayoutDefinition(definition)
    if (!isFullCoverage(parsed)) {
      throw new Error('Custom layout must fully cover the grid before use')
    }
    rememberAppliedCustomLayout(parsed)
    setLayout(parsed)
  }

  function setStyle(partial: Partial<CollageStyle>): void {
    patchPresent((draft) => {
      draft.style = { ...draft.style, ...structuredClone(partial) }
      if (partial.borders) {
        draft.style.borders = { ...draft.style.borders, ...partial.borders }
      }
      if (partial.background) {
        draft.style.background = {
          ...draft.style.background,
          ...partial.background,
        }
      }
      if (partial.watermark) {
        draft.style.watermark = {
          ...draft.style.watermark,
          ...partial.watermark,
        }
      }
      if (partial.aspectRatio) {
        draft.style.aspectRatio = { ...partial.aspectRatio }
      }
    })
  }

  function setAspectRatio(
    width: number,
    height: number,
    printSizeId: string | null = null,
    aspectSource: AspectSource = printSizeId ? 'print' : 'common',
    /** When `aspectSource` is `common`, omit to keep the current id (swap). */
    commonAspectId?: string | null,
  ): void {
    const nextCommonId =
      aspectSource === 'common'
        ? commonAspectId !== undefined
          ? commonAspectId
          : session.value.style.commonAspectId
        : null
    setStyle({
      aspectRatio: { width, height },
      printSizeId: aspectSource === 'print' ? printSizeId : null,
      aspectSource,
      commonAspectId: nextCommonId,
    })
  }

  function setDownloadQuality(quality: DownloadQuality): void {
    setStyle({ downloadQuality: quality })
  }

  function assignImage(cellIndex: number, imageId: string | null): void {
    patchPresent((draft) => {
      const cell = draft.cellImages[cellIndex]
      if (!cell) return
      cell.imageId = imageId
    })
  }

  /** Clear only the image assignment on a cell (layout / pan / scale unchanged). */
  function clearCellImage(cellIndex: number): void {
    assignImage(cellIndex, null)
  }

  /** Clear image assignments on every cell; layout / aspect / style / watermark unchanged. */
  function clearAllCellImages(): void {
    if (!session.value.cellImages.some((c) => c.imageId !== null)) return
    patchPresent((draft) => {
      for (const cell of draft.cellImages) {
        cell.imageId = null
      }
    })
  }

  function swapCells(a: number, b: number): void {
    patchPresent((draft) => {
      if (a < 0 || b < 0 || a >= draft.cellImages.length || b >= draft.cellImages.length) {
        return
      }
      const tmp = draft.cellImages[a]!
      draft.cellImages[a] = draft.cellImages[b]!
      draft.cellImages[b] = tmp
    })
  }

  function panCell(cellIndex: number, position: CellImagePosition): void {
    patchPresent((draft) => {
      const cell = draft.cellImages[cellIndex]
      if (!cell) return
      cell.position = {
        x: Math.min(100, Math.max(0, position.x)),
        y: Math.min(100, Math.max(0, position.y)),
      }
    })
  }

  function setCellScale(cellIndex: number, scale: number): void {
    patchPresent((draft) => {
      const cell = draft.cellImages[cellIndex]
      if (!cell) return
      cell.scale = clampCellScale(scale)
    })
  }

  /** Relative zoom (e.g. wheel ±0.1 or button). Commits one undo step. */
  function scaleCell(cellIndex: number, delta: number): void {
    const cell = session.value.cellImages[cellIndex]
    if (!cell) return
    setCellScale(cellIndex, clampCellScale(cell.scale) + delta)
  }

  function setRowFractions(fractions: number[]): void {
    const rows = session.value.layout?.grid.rows ?? fractions.length
    patchPresent((draft) => {
      draft.rowFractions = normalizeFractions(rows, fractions)
    })
  }

  function setColFractions(fractions: number[]): void {
    const cols = session.value.layout?.grid.cols ?? fractions.length
    patchPresent((draft) => {
      draft.colFractions = normalizeFractions(cols, fractions)
    })
  }

  /** Undoable redistribute (pointerup / tests). Live drag should use local preview + set*Fractions. */
  function redistributeRowGutter(
    gutterIndex: number,
    deltaNormalized: number,
    minFraction?: number,
  ): void {
    const rows = session.value.layout?.grid.rows ?? session.value.rowFractions.length
    patchPresent((draft) => {
      draft.rowFractions = redistributeAdjacent(
        normalizeFractions(rows, draft.rowFractions),
        gutterIndex,
        deltaNormalized,
        minFraction,
      )
    })
  }

  function redistributeColGutter(
    gutterIndex: number,
    deltaNormalized: number,
    minFraction?: number,
  ): void {
    const cols = session.value.layout?.grid.cols ?? session.value.colFractions.length
    patchPresent((draft) => {
      draft.colFractions = redistributeAdjacent(
        normalizeFractions(cols, draft.colFractions),
        gutterIndex,
        deltaNormalized,
        minFraction,
      )
    })
  }

  function selectCell(index: number | null): void {
    // Selection is ephemeral UI — still snapshot so undo restores it with style ops.
    patchPresent((draft) => {
      if (index === null) {
        draft.selectedCellIndex = null
        return
      }
      if (index < 0 || index >= draft.cellImages.length) {
        draft.selectedCellIndex = null
        return
      }
      draft.selectedCellIndex = index
    })
  }

  function resetStyles(): void {
    patchPresent((draft) => {
      draft.style = structuredClone(DEFAULT_STYLE)
    })
  }

  function undo(): void {
    history.value = undoHistory(history.value)
  }

  function redo(): void {
    history.value = redoHistory(history.value)
  }

  /** Replace history with a fresh default session (tests / hard reset). */
  function resetSession(): void {
    history.value = createHistoryStack(createDefaultSessionState())
  }

  return {
    session,
    previewFrameSize,
    setPreviewFrameSize,
    layout,
    style,
    cellImages,
    rowFractions,
    colFractions,
    selectedCellIndex,
    undoAvailable,
    redoAvailable,
    setLayout,
    applyCustomLayout,
    setStyle,
    setAspectRatio,
    setDownloadQuality,
    assignImage,
    clearCellImage,
    clearAllCellImages,
    swapCells,
    panCell,
    setCellScale,
    scaleCell,
    setRowFractions,
    setColFractions,
    redistributeRowGutter,
    redistributeColGutter,
    selectCell,
    resetStyles,
    undo,
    redo,
    resetSession,
  }
})
