import { onMounted, onUnmounted, reactive, ref, type ComputedRef, type Ref } from 'vue'
import { CELL_SCALE_STEP, DEFAULT_CELL_SCALE, clampCellScale } from '@/entities/session'
import type { useCollageStore } from '@/features/canvas'
import type { useImageRegistry } from '@/features/images'

const NUDGE = 2

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
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

  const dragSwap = ref<{ from: number } | null>(null)
  const panDrag = ref<{
    index: number
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)

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

  /** Cover × scale × position: transform scale around object-position origin. */
  function imagePreviewStyle(index: number): Record<string, string> {
    const p = positionFor(index)
    const s = scaleFor(index)
    return {
      objectPosition: `${p.x}% ${p.y}%`,
      transform: s === 1 ? 'none' : `scale(${s})`,
      transformOrigin: `${p.x}% ${p.y}%`,
    }
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
    }
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }

  function onPointerDown(event: PointerEvent, index: number): void {
    if (isGutterDragging.value) return
    collage.selectCell(index)
    const wantsPan = (panMode.value || event.altKey) && cellHasImage(index)
    if (wantsPan) {
      startPan(event, index)
      return
    }
    if (collage.cellImages[index]?.imageId) {
      dragSwap.value = { from: index }
    }
  }

  function onPanPointerMove(event: PointerEvent): boolean {
    if (!panDrag.value) return false
    const dx = event.clientX - panDrag.value.startX
    const dy = event.clientY - panDrag.value.startY
    // Invert delta: object-position % moves opposite to content — drag should follow finger
    livePan[panDrag.value.index] = {
      x: clamp(panDrag.value.originX - dx * 0.15, 0, 100),
      // Vertical factor slightly higher so up/down feels at least as responsive as left/right
      y: clamp(panDrag.value.originY - dy * 0.22, 0, 100),
    }
    return true
  }

  function onPointerUp(event: PointerEvent, index: number): boolean {
    if (panDrag.value) {
      const final = livePan[panDrag.value.index]
      if (final) {
        collage.panCell(panDrag.value.index, final)
        delete livePan[panDrag.value.index]
      }
      panDrag.value = null
      return true
    }
    if (dragSwap.value && dragSwap.value.from !== index) {
      collage.swapCells(dragSwap.value.from, index)
    }
    dragSwap.value = null
    void event
    return false
  }

  function cancelCellPointer(): void {
    if (panDrag.value) {
      delete livePan[panDrag.value.index]
      panDrag.value = null
    }
    dragSwap.value = null
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
    onCellWheel,
    togglePanMode,
    zoomIn,
    zoomOut,
    zoomReset,
  }
}
