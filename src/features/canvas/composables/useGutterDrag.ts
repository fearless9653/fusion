import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { LayoutDefinition } from '@/entities/layout'
import type { CollageStyle } from '@/entities/session'
import type { useCollageStore } from '@/features/canvas'
import { measureSharedGutterSegments, normalizeFractions, redistributeAdjacent } from '@/shared/lib'

/**
 * Minimum gutter hit size in CSS px (transparent overlay).
 * Visual gap still comes from grid `gap`; this only widens the grab target for mouse + touch.
 */
export const GUTTER_HIT_MIN_PX = 28

/** Resolve overlay hit thickness from spacing gap. */
export function gutterHitPx(gap: number): number {
  const g = Math.max(0, gap)
  return Math.max(GUTTER_HIT_MIN_PX, g || GUTTER_HIT_MIN_PX)
}

type GutterOverlay = {
  axis: 'row' | 'col'
  index: number
  key: string
  style: Record<string, string>
}

export function useGutterDrag(options: {
  collage: ReturnType<typeof useCollageStore>
  layout: ComputedRef<LayoutDefinition | null>
  style: ComputedRef<CollageStyle>
  gridEl: Ref<HTMLElement | null>
  gridBox: Ref<{ width: number; height: number }>
}) {
  const { collage, layout, style, gridEl, gridBox } = options

  const liveRowFractions = ref<number[] | null>(null)
  const liveColFractions = ref<number[] | null>(null)

  const gutterDrag = ref<{
    axis: 'row' | 'col'
    gutterIndex: number
    startClient: number
    origin: number[]
  } | null>(null)

  const displayRowFractions = computed(() => {
    const rows = layout.value?.grid.rows ?? 0
    return normalizeFractions(rows, liveRowFractions.value ?? collage.rowFractions)
  })

  const displayColFractions = computed(() => {
    const cols = layout.value?.grid.cols ?? 0
    return normalizeFractions(cols, liveColFractions.value ?? collage.colFractions)
  })

  /**
   * Pixel-accurate gutter hit targets only where two cells share a boundary
   * (segments — no full-track ghosts across irregular spans).
   */
  const measuredGutters = computed((): GutterOverlay[] => {
    const lay = layout.value
    if (!lay) return []
    const gap = Math.max(0, style.value.spacing)
    const w = gridBox.value.width
    const h = gridBox.value.height
    if (w <= 0 || h <= 0) return []

    const hit = gutterHitPx(gap)
    const segments = measureSharedGutterSegments({
      cells: lay.cells,
      rowFractions: displayRowFractions.value,
      colFractions: displayColFractions.value,
      gridWidth: w,
      gridHeight: h,
      gap,
    })

    return segments.map((seg) => {
      const half = hit / 2
      if (seg.axis === 'col') {
        return {
          axis: 'col' as const,
          index: seg.index,
          key: `col-${seg.index}-${Math.round(seg.start)}`,
          style: {
            top: `${seg.start}px`,
            height: `${seg.length}px`,
            left: `${seg.center - half}px`,
            width: `${hit}px`,
            cursor: 'col-resize',
          },
        }
      }
      return {
        axis: 'row' as const,
        index: seg.index,
        key: `row-${seg.index}-${Math.round(seg.start)}`,
        style: {
          left: `${seg.start}px`,
          width: `${seg.length}px`,
          top: `${seg.center - half}px`,
          height: `${hit}px`,
          cursor: 'row-resize',
        },
      }
    })
  })

  function onGutterPointerDown(
    event: PointerEvent,
    axis: 'row' | 'col',
    gutterIndex: number,
  ): void {
    if (event.isPrimary === false) return
    if (typeof event.button === 'number' && event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const origin = axis === 'row' ? [...displayRowFractions.value] : [...displayColFractions.value]
    gutterDrag.value = {
      axis,
      gutterIndex,
      startClient: axis === 'col' ? event.clientX : event.clientY,
      origin,
    }
    if (axis === 'row') liveRowFractions.value = [...origin]
    else liveColFractions.value = [...origin]
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }

  function onGutterPointerMove(event: PointerEvent): boolean {
    if (!gutterDrag.value || !gridEl.value) return false
    const { axis, gutterIndex, startClient, origin } = gutterDrag.value
    const gap = Math.max(0, style.value.spacing)
    const el = gridEl.value
    const client = axis === 'col' ? event.clientX : event.clientY
    const deltaPx = client - startClient
    const sum = origin.reduce((a, b) => a + b, 0) || 1
    const axisPx = axis === 'col' ? el.clientWidth : el.clientHeight
    const usable = Math.max(1, axisPx - gap * Math.max(0, origin.length - 1))
    const deltaNormalized = (deltaPx / usable) * sum
    const next = redistributeAdjacent(origin, gutterIndex, deltaNormalized)
    if (axis === 'row') liveRowFractions.value = next
    else liveColFractions.value = next
    return true
  }

  function finishGutterDrag(): void {
    const drag = gutterDrag.value
    if (!drag) return
    if (drag.axis === 'row' && liveRowFractions.value) {
      collage.setRowFractions(liveRowFractions.value)
    }
    if (drag.axis === 'col' && liveColFractions.value) {
      collage.setColFractions(liveColFractions.value)
    }
    liveRowFractions.value = null
    liveColFractions.value = null
    gutterDrag.value = null
  }

  function cancelGutterDrag(): boolean {
    if (!gutterDrag.value) return false
    liveRowFractions.value = null
    liveColFractions.value = null
    gutterDrag.value = null
    return true
  }

  return {
    gutterDrag,
    displayRowFractions,
    displayColFractions,
    measuredGutters,
    onGutterPointerDown,
    onGutterPointerMove,
    finishGutterDrag,
    cancelGutterDrag,
  }
}
