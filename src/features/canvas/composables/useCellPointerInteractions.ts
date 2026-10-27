import { onMounted, onUnmounted, reactive, ref, type ComputedRef, type Ref } from 'vue'
import { CELL_SCALE_STEP, DEFAULT_CELL_SCALE, clampCellScale } from '@/entities/session'
import type { useCollageStore } from '@/features/canvas'
import type { useImageRegistry } from '@/features/images'

const NUDGE = 2
/** Screen px before a press is treated as a drag (swap / suppress click→picker). */
const DRAG_THRESHOLD_PX = 8

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function cellIndexFromPoint(clientX: number, clientY: number): number | null {
  if (typeof document === 'undefined') return null
  const el = document.elementFromPoint(clientX, clientY)
  const host = el?.closest?.('[data-cell-index]') as HTMLElement | null
  if (!host) return null
  const raw = host.dataset.cellIndex
  if (raw === undefined || raw === '') return null
  const index = Number(raw)
  return Number.isInteger(index) && index >= 0 ? index : null
}

export function useCellPointerInteractions(options: {
  collage: ReturnType<typeof useCollageStore>
  registry: ReturnType<typeof useImageRegistry>
  /** True while a gutter drag is active (skip cell pan/swap). */
  isGutterDragging: Ref<boolean> | ComputedRef<boolean>
}) {
  const { collage, registry, isGutterDragging } = options

  /** Live pan overrides while pan-dragging (committed on pointerup). */
  const livePan = reactive<Record<number, { x: number; y: number }>>({})

  /** Ephemeral UI: pan vs swap/default drag (not in undo history). */
  const panMode = ref(false)

  const dragSwap = ref<{
    from: number
    startX: number
    startY: number
    moved: boolean
  } | null>(null)
  const panDrag = ref<{
    index: number
    startX: number
    startY: number
    originX: number
    originY: number
    moved: boolean
  } | null>(null)

  /** Set on pointerup after a real drag; consumed by the next cell click. */
  let suppressNextClick = false

  function cellHasImage(index: number): boolean {
    const id = collage.cellImages[index]?.imageId
    return Boolean(id && registry.get(id))
  }

  function positionFor(index: number): { x: number; y: number } {
    if (livePan[index]) return livePan[index]!
    return collage.cellImages[index]?.position ?? { x: 50, y: 50 }
  }

  function scaleFor(index: number): number {
    return clampCellScale(collage.cellImages[index]?.scale)
  }

  /**
   * Cover × scale × position only.
   * Orientation is eager-baked into the display bitmap — no CSS rotate/flip/cqw.
   */
  function imagePreviewStyle(index: number): Record<string, string> {
    const p = positionFor(index)
    const s = scaleFor(index)
    const style: Record<string, string> = {
      objectPosition: p.x + '% ' + p.y + '%',
      transformOrigin: p.x + '% ' + p.y + '%',
    }
    if (s !== 1) {
      style.transform = 'scale(' + s + ')'
    }
    return style
  }

  function startPan(event: PointerEvent, index: number): void {
    event.preventDefault()
    const pos = positionFor(index)
    panDrag.value = {
      index,
      startX: event.clientX,
      startY: event.clientY,
      originX: pos.x,
      originY: pos.y,
      moved: false,
    }
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }

  function onPointerDown(event: PointerEvent, index: number): void {
    if (isGutterDragging.value) return
    // Ignore non-primary (mouse secondary / multi-touch extras).
    if (event.isPrimary === false) return
    if (typeof event.button === 'number' && event.button !== 0) return

    collage.selectCell(index)
    const wantsPan = (panMode.value || event.altKey) && cellHasImage(index)
    if (wantsPan) {
      startPan(event, index)
      return
    }
    if (collage.cellImages[index]?.imageId) {
      dragSwap.value = {
        from: index,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
      }
      // Capture so finger leaving the start cell still delivers move/up here;
      // drop target is resolved via elementFromPoint on pointerup.
      ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    }
  }

  function onPanPointerMove(event: PointerEvent): boolean {
    if (panDrag.value) {
      const dx = event.clientX - panDrag.value.startX
      const dy = event.clientY - panDrag.value.startY
      if (!panDrag.value.moved && dx * dx + dy * dy >= DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
        panDrag.value.moved = true
      }
      // Invert delta: object-position % moves opposite to content — drag should follow finger.
      // Display bitmap is identity-oriented, so screen deltas map 1:1 (no rotate/flip remap).
      livePan[panDrag.value.index] = {
        x: clamp(panDrag.value.originX - dx * 0.15, 0, 100),
        y: clamp(panDrag.value.originY - dy * 0.22, 0, 100),
      }
      return true
    }
    if (dragSwap.value) {
      const dx = event.clientX - dragSwap.value.startX
      const dy = event.clientY - dragSwap.value.startY
      if (!dragSwap.value.moved && dx * dx + dy * dy >= DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
        dragSwap.value.moved = true
      }
      return true
    }
    return false
  }

  function onPointerUp(event: PointerEvent, _index: number): boolean {
    if (panDrag.value) {
      if (panDrag.value.moved) suppressNextClick = true
      const final = livePan[panDrag.value.index]
      if (final) {
        collage.panCell(panDrag.value.index, final)
        delete livePan[panDrag.value.index]
      }
      panDrag.value = null
      return true
    }
    if (dragSwap.value) {
      const { from, moved } = dragSwap.value
      dragSwap.value = null
      if (moved) {
        suppressNextClick = true
        const to = cellIndexFromPoint(event.clientX, event.clientY)
        if (to !== null && to !== from && to < collage.cellImages.length) {
          collage.swapCells(from, to)
        }
      }
      return moved
    }
    return false
  }

  function cancelCellPointer(): void {
    if (panDrag.value) {
      delete livePan[panDrag.value.index]
      panDrag.value = null
    }
    dragSwap.value = null
  }

  /** True when the next cell click should be ignored (drag crossed threshold). */
  function consumeClickSuppression(): boolean {
    if (!suppressNextClick) return false
    suppressNextClick = false
    return true
  }

  function onKeyDown(event: KeyboardEvent): void {
    const idx = collage.selectedCellIndex
    if (idx === null) return
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return
    event.preventDefault()
    const pos = { ...positionFor(idx) }
    if (event.key === 'ArrowLeft') pos.x = clamp(pos.x - NUDGE, 0, 100)
    if (event.key === 'ArrowRight') pos.x = clamp(pos.x + NUDGE, 0, 100)
    if (event.key === 'ArrowUp') pos.y = clamp(pos.y - NUDGE, 0, 100)
    if (event.key === 'ArrowDown') pos.y = clamp(pos.y + NUDGE, 0, 100)
    collage.panCell(idx, pos)
  }

  function onCellWheel(event: WheelEvent, index: number): void {
    if (collage.selectedCellIndex !== index) return
    if (!cellHasImage(index)) return
    event.preventDefault()
    const delta = event.deltaY < 0 ? CELL_SCALE_STEP : -CELL_SCALE_STEP
    collage.scaleCell(index, delta)
  }

  function togglePanMode(event: Event): void {
    event.stopPropagation()
    event.preventDefault()
    panMode.value = !panMode.value
  }

  function zoomIn(event: Event, index: number): void {
    event.stopPropagation()
    event.preventDefault()
    collage.scaleCell(index, CELL_SCALE_STEP)
  }

  function zoomOut(event: Event, index: number): void {
    event.stopPropagation()
    event.preventDefault()
    collage.scaleCell(index, -CELL_SCALE_STEP)
  }

  function zoomReset(event: Event, index: number): void {
    event.stopPropagation()
    event.preventDefault()
    collage.setCellScale(index, DEFAULT_CELL_SCALE)
  }

  function rotateCw(event: Event, index: number): void {
    event.stopPropagation()
    event.preventDefault()
    void collage.rotateCellImageCw(index)
  }

  function flipHorizontal(event: Event, index: number): void {
    event.stopPropagation()
    event.preventDefault()
    void collage.flipCellImageX(index)
  }

  function flipVertical(event: Event, index: number): void {
    event.stopPropagation()
    event.preventDefault()
    void collage.flipCellImageY(index)
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeyDown)
  })
  onUnmounted(() => {
    window.removeEventListener('keydown', onKeyDown)
  })

  return {
    panMode,
    cellHasImage,
    positionFor,
    scaleFor,
    imagePreviewStyle,
    onPointerDown,
    onPanPointerMove,
    onPointerUp,
    cancelCellPointer,
    consumeClickSuppression,
    onCellWheel,
    togglePanMode,
    zoomIn,
    zoomOut,
    zoomReset,
    rotateCw,
    flipHorizontal,
    flipVertical,
  }
}
