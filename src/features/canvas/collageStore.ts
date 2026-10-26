import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { LayoutDefinition } from '@/entities/layout'
import { isFullCoverage, parseLayoutDefinition } from '@/entities/layout'
import type {
  AspectSource,
  CellImageAssignment,
  CellImagePosition,
  CellImageTransform,
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
  DEFAULT_CELL_FLIP_X,
  DEFAULT_CELL_FLIP_Y,
  DEFAULT_CELL_ROTATION,
  cellTransformsEqual,
  isIdentityCellTransform,
  normalizeCellRotation,
  pushHistory,
  redoHistory,
  resolveCellTransform,
  flipCellHorizontalScreen,
  flipCellVerticalScreen,
  rotateCellCw,
  toCanonicalCellTransform,
  undoHistory,
} from '@/entities/session'
import type { HistoryStack } from '@/entities/session'
import { useImageRegistry } from '@/features/images'
import { normalizeFractions, redistributeAdjacent } from '@/shared/lib'
import { rememberAppliedCustomLayout } from './customLayoutRegistry'

function cloneSession(state: CollageSessionState): CollageSessionState {
  // JSON round-trip: session is serializable and may be a Vue reactive proxy.
  return JSON.parse(JSON.stringify(state)) as CollageSessionState
}

function normalizeCellAssignment(cell: CellImageAssignment): CellImageAssignment {
  const next = structuredClone(cell)
  next.scale = clampCellScale(next.scale)
  next.rotation = normalizeCellRotation(next.rotation)
  next.flipX = Boolean(next.flipX)
  next.flipY = Boolean(next.flipY)
  // Migrate older snapshots that only had imageId.
  if (next.sourceImageId == null && next.imageId != null) {
    next.sourceImageId = next.imageId
  }
  if (next.sourceImageId === undefined) next.sourceImageId = null
  return next
}

function resizeCellImages(
  previous: CollageSessionState['cellImages'],
  count: number,
): CollageSessionState['cellImages'] {
  const next = createEmptyCellImages(count)
  for (let i = 0; i < Math.min(previous.length, count); i += 1) {
    next[i] = normalizeCellAssignment(previous[i]!)
  }
  return next
}

function resetFractionsForLayout(draft: CollageSessionState, layout: LayoutDefinition): void {
  draft.rowFractions = createEqualFractions(layout.grid.rows)
  draft.colFractions = createEqualFractions(layout.grid.cols)
}

function cellBakeId(cell: CellImageAssignment): string | null {
  if (cell.imageId && cell.sourceImageId && cell.imageId !== cell.sourceImageId) {
    return cell.imageId
  }
  return null
}

/** Coalesce window for rapid rotate/flip — bake only the latest pending target. */
export const ORIENTATION_BAKE_COALESCE_MS = 120

let orientationBakeCoalesceMsForTests: number | null = null

/** Test helper: set coalesce delay (null restores default). */
export function setOrientationBakeCoalesceMsForTests(ms: number | null): void {
  orientationBakeCoalesceMsForTests = ms
}

function orientationBakeCoalesceMs(): number {
  return orientationBakeCoalesceMsForTests ?? ORIENTATION_BAKE_COALESCE_MS
}

export const useCollageStore = defineStore('collage', () => {
  const history = ref<HistoryStack<CollageSessionState>>(
    createHistoryStack(createDefaultSessionState()),
  )

  /** On-screen collage frame CSS px (not in undo history). Used to scale export style. */
  const previewFrameSize = ref<{ width: number; height: number }>({ width: 0, height: 0 })

  /** Serialize orientation bakes so rapid clicks do not race. */
  let bakeChain: Promise<void> = Promise.resolve()

  /** Latest pending canonical orientation per cell (coalesce rapid clicks). */
  const pendingOrientationByCell = new Map<number, CellImageTransform>()
  /** Target currently being baked (so mid-flight clicks compose from it, not stale session). */
  const inflightOrientationByCell = new Map<number, CellImageTransform>()
  let coalesceTimer: ReturnType<typeof setTimeout> | null = null
  let coalesceWaiters: Array<{
    resolve: () => void
    reject: (reason?: unknown) => void
  }> = []

  function bakeIdUsedByAnyCell(bakeId: string, draft?: CollageSessionState): boolean {
    const cells = draft?.cellImages ?? session.value.cellImages
    return cells.some((c) => c.imageId === bakeId)
  }

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
    /** When spectSource is common, omit to keep the current id (swap). */
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

  /**
   * Ensure display imageId matches logical orientation vs sourceImageId.
   * Canonicalizes transform (≤8), reuses existing derived for same source+canonical,
   * identity → display === source and prior bake removed.
   */
  async function applyOrientationToCell(
    draft: CellImageAssignment,
    transform: CellImageTransform,
    options?: { previousBakeId?: string | null; sessionDraft?: CollageSessionState },
  ): Promise<void> {
    const registry = useImageRegistry()
    const canonical = toCanonicalCellTransform(transform)
    const sourceId = draft.sourceImageId
    draft.rotation = canonical.rotation
    draft.flipX = canonical.flipX
    draft.flipY = canonical.flipY
    if (!sourceId) {
      draft.imageId = null
      return
    }
    const dropBake = (bakeId: string | null | undefined) => {
      if (!bakeId || bakeId === sourceId) return
      // Ignore the cell we are retargeting — its imageId still points at the old bake.
      if (options?.sessionDraft) {
        const usedElsewhere = options.sessionDraft.cellImages.some(
          (c) => c !== draft && c.imageId === bakeId,
        )
        if (usedElsewhere) return
      }
      registry.remove(bakeId)
    }
    if (isIdentityCellTransform(canonical)) {
      dropBake(options?.previousBakeId)
      if (draft.imageId && draft.imageId !== sourceId) dropBake(draft.imageId)
      draft.imageId = sourceId
      return
    }
    const source = registry.get(sourceId)
    if (!source) {
      // Stub / missing registry entry (tests): keep logical params, display source id.
      draft.imageId = sourceId
      return
    }
    // Reuse in-place bake when display already matches source+canonical.
    if (
      draft.imageId &&
      draft.imageId !== sourceId &&
      registry.get(draft.imageId)?.bakeTransform &&
      cellTransformsEqual(registry.get(draft.imageId)!.bakeTransform, canonical)
    ) {
      return
    }
    const baked = await registry.addBakedFrom(sourceId, canonical)
    if (options?.previousBakeId && options.previousBakeId !== baked.id) {
      dropBake(options.previousBakeId)
    } else if (draft.imageId && draft.imageId !== sourceId && draft.imageId !== baked.id) {
      dropBake(draft.imageId)
    }
    draft.imageId = baked.id
  }

  function assignImage(cellIndex: number, imageId: string | null): void {
    const previous = session.value.cellImages[cellIndex]
    if (!previous) return
    pendingOrientationByCell.delete(cellIndex)
    inflightOrientationByCell.delete(cellIndex)
    const previousBakeId = cellBakeId(previous)
    const logical = toCanonicalCellTransform(previous)
    // Common path: no orientation bake — commit synchronously for UI/tests.
    if (!imageId || isIdentityCellTransform(logical)) {
      patchPresent((draft) => {
        const cell = draft.cellImages[cellIndex]
        if (!cell) return
        if (previousBakeId) useImageRegistry().remove(previousBakeId)
        cell.sourceImageId = imageId
        cell.imageId = imageId
      })
      return
    }
    // Replacing an oriented cell: re-bake from the new source; queue to avoid races.
    bakeChain = bakeChain.then(async () => {
      const draft = cloneSession(session.value)
      const cell = draft.cellImages[cellIndex]
      if (!cell) return
      if (previousBakeId) useImageRegistry().remove(previousBakeId)
      cell.sourceImageId = imageId
      cell.imageId = imageId
      await applyOrientationToCell(cell, logical, { sessionDraft: draft })
      commit(draft)
    })
    void bakeChain
  }

  /** Clear image assignment; reset logical rotate/flip to defaults (pan/scale kept). */
  function clearCellImage(cellIndex: number): void {
    pendingOrientationByCell.delete(cellIndex)
    inflightOrientationByCell.delete(cellIndex)
    patchPresent((draft) => {
      const cell = draft.cellImages[cellIndex]
      if (!cell) return
      const bakeId = cellBakeId(cell)
      cell.sourceImageId = null
      cell.imageId = null
      cell.rotation = DEFAULT_CELL_ROTATION
      cell.flipX = DEFAULT_CELL_FLIP_X
      cell.flipY = DEFAULT_CELL_FLIP_Y
      if (bakeId && !bakeIdUsedByAnyCell(bakeId, draft)) {
        useImageRegistry().remove(bakeId)
      }
    })
  }

  /** Clear image assignments on every cell; reset logical rotate/flip (layout/style kept). */
  function clearAllCellImages(): void {
    if (
      !session.value.cellImages.some(
        (c) =>
          c.imageId !== null ||
          c.sourceImageId !== null ||
          c.rotation !== DEFAULT_CELL_ROTATION ||
          c.flipX ||
          c.flipY,
      )
    ) {
      return
    }
    pendingOrientationByCell.clear()
    inflightOrientationByCell.clear()
    patchPresent((draft) => {
      const bakeIds = new Set<string>()
      for (const cell of draft.cellImages) {
        const bakeId = cellBakeId(cell)
        if (bakeId) bakeIds.add(bakeId)
        cell.sourceImageId = null
        cell.imageId = null
        cell.rotation = DEFAULT_CELL_ROTATION
        cell.flipX = DEFAULT_CELL_FLIP_X
        cell.flipY = DEFAULT_CELL_FLIP_Y
      }
      const registry = useImageRegistry()
      for (const bakeId of bakeIds) registry.remove(bakeId)
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

  async function flushPendingOrientations(): Promise<void> {
    while (pendingOrientationByCell.size > 0) {
      const batch = new Map(pendingOrientationByCell)
      pendingOrientationByCell.clear()
      for (const [cellIndex, transform] of batch) {
        // A newer click may have re-queued this cell while we baked others.
        if (pendingOrientationByCell.has(cellIndex)) continue
        const current = session.value.cellImages[cellIndex]
        if (!current) {
          inflightOrientationByCell.delete(cellIndex)
          continue
        }
        const previousBakeId = cellBakeId(current)
        const draft = cloneSession(session.value)
        const cell = draft.cellImages[cellIndex]
        if (!cell) {
          inflightOrientationByCell.delete(cellIndex)
          continue
        }
        if (!cell.sourceImageId && cell.imageId) cell.sourceImageId = cell.imageId
        inflightOrientationByCell.set(cellIndex, transform)
        try {
          await applyOrientationToCell(cell, transform, {
            previousBakeId,
            sessionDraft: draft,
          })
          commit(draft)
        } finally {
          inflightOrientationByCell.delete(cellIndex)
        }
      }
    }
  }

  function scheduleCoalescedOrientationBake(): Promise<void> {
    return new Promise((resolve, reject) => {
      coalesceWaiters.push({ resolve, reject })
      if (coalesceTimer) clearTimeout(coalesceTimer)
      const delay = orientationBakeCoalesceMs()
      coalesceTimer = setTimeout(() => {
        coalesceTimer = null
        const waiters = coalesceWaiters
        coalesceWaiters = []
        bakeChain = bakeChain.then(flushPendingOrientations, flushPendingOrientations)
        void bakeChain.then(
          () => {
            for (const w of waiters) w.resolve()
          },
          (err) => {
            for (const w of waiters) w.reject(err)
          },
        )
      }, delay)
    })
  }

  /**
   * Queue a canonical orientation target for a cell.
   * Rapid clicks only keep the latest pending target (coalesce); a light
   * coalesce window (~120ms) avoids flooding bakes — coalesce is primary.
   */
  function queueCellOrientation(
    cellIndex: number,
    updater: (current: CellImageTransform) => CellImageTransform,
  ): Promise<void> {
    const cell = session.value.cellImages[cellIndex]
    if (!cell?.sourceImageId && !cell?.imageId) return Promise.resolve()
    const base =
      pendingOrientationByCell.get(cellIndex) ??
      inflightOrientationByCell.get(cellIndex) ??
      toCanonicalCellTransform(resolveCellTransform(cell))
    const next = toCanonicalCellTransform(updater(base))
    pendingOrientationByCell.set(cellIndex, next)
    return scheduleCoalescedOrientationBake()
  }

  /** Clockwise 90° logical rotation; eager-bakes display from source. */
  async function rotateCellImageCw(cellIndex: number): Promise<void> {
    await queueCellOrientation(cellIndex, (current) => ({
      ...current,
      rotation: rotateCellCw(current.rotation),
    }))
  }

  /** Toggle screen-space horizontal mirror (左右 / left-right on screen); eager-bake. */
  async function flipCellImageX(cellIndex: number): Promise<void> {
    await queueCellOrientation(cellIndex, (current) => flipCellHorizontalScreen(current))
  }

  /** Toggle screen-space vertical mirror (上下 / up-down on screen); eager-bake. */
  async function flipCellImageY(cellIndex: number): Promise<void> {
    await queueCellOrientation(cellIndex, (current) => flipCellVerticalScreen(current))
  }

  /**
   * After undo/redo, session may point at a deleted bake id — re-bake from source
   * without pushing a new history entry.
   */
  async function syncBakesAfterHistoryChange(): Promise<void> {
    const run = async (): Promise<void> => {
      const registry = useImageRegistry()
      const draft = cloneSession(session.value)
      let changed = false
      for (const cell of draft.cellImages) {
        if (!cell.sourceImageId && cell.imageId) {
          cell.sourceImageId = cell.imageId
          changed = true
        }
        const sourceId = cell.sourceImageId
        if (!sourceId) continue
        const tf = toCanonicalCellTransform(cell)
        cell.rotation = tf.rotation
        cell.flipX = tf.flipX
        cell.flipY = tf.flipY
        if (isIdentityCellTransform(tf)) {
          if (cell.imageId !== sourceId) {
            if (cell.imageId && cell.imageId !== sourceId) registry.remove(cell.imageId)
            cell.imageId = sourceId
            changed = true
          }
          continue
        }
        if (cell.imageId && cell.imageId !== sourceId && registry.get(cell.imageId)) {
          continue
        }
        if (!registry.get(sourceId)) {
          cell.imageId = sourceId
          changed = true
          continue
        }
        const baked = await registry.addBakedFrom(sourceId, tf)
        cell.imageId = baked.id
        changed = true
      }
      if (changed) {
        history.value = {
          ...history.value,
          present: cloneSession(draft),
        }
      }
    }
    bakeChain = bakeChain.then(run, run)
    await bakeChain
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
    void syncBakesAfterHistoryChange()
  }

  function redo(): void {
    history.value = redoHistory(history.value)
    void syncBakesAfterHistoryChange()
  }

  /** Replace history with a fresh default session (tests / hard reset). */
  function resetSession(): void {
    pendingOrientationByCell.clear()
    inflightOrientationByCell.clear()
    if (coalesceTimer) {
      clearTimeout(coalesceTimer)
      coalesceTimer = null
    }
    coalesceWaiters = []
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
    rotateCellImageCw,
    flipCellImageX,
    flipCellImageY,
    setRowFractions,
    setColFractions,
    redistributeRowGutter,
    redistributeColGutter,
    selectCell,
    resetStyles,
    undo,
    redo,
    resetSession,
    syncBakesAfterHistoryChange,
  }
})
