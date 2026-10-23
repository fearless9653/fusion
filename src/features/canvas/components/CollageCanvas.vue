<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CellChrome from '@/features/canvas/components/CellChrome.vue'
import { CELL_SCALE_STEP, DEFAULT_CELL_SCALE, clampCellScale } from '@/entities/session'
import { useCollageStore } from '@/features/canvas'
import {
  estimateTextSize,
  resolveWatermarkMode,
  resolveWatermarkPosition,
  watermarkSingleAnchor,
  watermarkTileOffsets,
} from '@/features/watermark'
import {
  assignImagesFromIndex,
  imageFilesFromList,
  isFileDrag,
  useImageRegistry,
} from '@/features/images'
import {
  fitAspectRect,
  fractionsToCssTemplate,
  measureSharedGutterSegments,
  normalizeFractions,
  redistributeAdjacent,
} from '@/shared/lib'

const NUDGE = 2
const GUTTER_HIT = 8

const { t } = useI18n()
const collage = useCollageStore()
const registry = useImageRegistry()
const cellFileInput = ref<HTMLInputElement | null>(null)
const pendingCellUploadIndex = ref<number | null>(null)
const stageEl = ref<HTMLElement | null>(null)
const gridEl = ref<HTMLElement | null>(null)
const stageSize = ref({ width: 0, height: 0 })
const gridBox = ref({ width: 0, height: 0 })
let stageObserver: ResizeObserver | null = null
let gridObserver: ResizeObserver | null = null

/** Live pan overrides while pan-dragging (committed on pointerup). */
const livePan = reactive<Record<number, { x: number; y: number }>>({})

/** Live track fractions while dragging a gutter (committed on pointerup). */
const liveRowFractions = ref<number[] | null>(null)
const liveColFractions = ref<number[] | null>(null)

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

const gutterDrag = ref<{
  axis: 'row' | 'col'
  gutterIndex: number
  startClient: number
  origin: number[]
} | null>(null)

const layout = computed(() => collage.layout)
const style = computed(() => collage.style)

const displayRowFractions = computed(() => {
  const rows = layout.value?.grid.rows ?? 0
  return normalizeFractions(rows, liveRowFractions.value ?? collage.rowFractions)
})

const displayColFractions = computed(() => {
  const cols = layout.value?.grid.cols ?? 0
  return normalizeFractions(cols, liveColFractions.value ?? collage.colFractions)
})

const bgImageUrl = computed(() => {
  const id = style.value.background.imageId
  if (!id) return null
  return registry.get(id)?.objectUrl ?? null
})

/** Pixel size that preserves aspect and fits the stage (contain). */
const canvasSize = computed(() => {
  const { width, height } = style.value.aspectRatio
  return fitAspectRect(stageSize.value.width, stageSize.value.height, width, height)
})

watch(
  canvasSize,
  (size) => {
    collage.setPreviewFrameSize(size.width, size.height)
  },
  { immediate: true },
)

const watermarkPreview = computed(() => {
  const wm = style.value.watermark
  if (!wm.enabled || !wm.text.trim()) {
    return { mode: 'tile' as const, items: [] as Array<{ x: number; y: number }> }
  }
  const w = canvasSize.value.width
  const h = canvasSize.value.height
  if (w <= 0 || h <= 0) {
    return { mode: 'tile' as const, items: [] as Array<{ x: number; y: number }> }
  }
  const text = wm.text.trim()
  const metrics = estimateTextSize(text, wm.fontSize)
  const mode = resolveWatermarkMode(wm)
  if (mode === 'single') {
    const a = watermarkSingleAnchor(resolveWatermarkPosition(wm), w, h, metrics, wm.rotation)
    return { mode: 'single' as const, items: [{ x: a.x, y: a.y }] }
  }
  // Center-relative offsets (same metrics/step as drawWatermark).
  return {
    mode: 'tile' as const,
    items: watermarkTileOffsets(w, h, wm.fontSize, wm.density, metrics),
  }
})

const canvasBoxStyle = computed(() => {
  const { width, height } = canvasSize.value
  const ratioW = style.value.aspectRatio.width
  const ratioH = style.value.aspectRatio.height
  return {
    width: width > 0 ? `${width}px` : '100%',
    height: height > 0 ? `${height}px` : 'auto',
    aspectRatio: `${ratioW} / ${ratioH}`,
    maxWidth: '100%',
    maxHeight: '100%',
    backgroundColor: style.value.background.color,
    backgroundImage: bgImageUrl.value ? `url(${bgImageUrl.value})` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }
})

const gridTemplateStyle = computed(() => ({
  gridTemplateRows: fractionsToCssTemplate(displayRowFractions.value),
  gridTemplateColumns: fractionsToCssTemplate(displayColFractions.value),
  gap: `${style.value.spacing}px`,
}))

type GutterOverlay = {
  axis: 'row' | 'col'
  index: number
  key: string
  style: Record<string, string>
}

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

  const hit = Math.max(GUTTER_HIT, gap || GUTTER_HIT)
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

function cellGridStyle(cell: { row: number; col: number; rowSpan: number; colSpan: number }) {
  return {
    gridRow: `${cell.row + 1} / span ${cell.rowSpan}`,
    gridColumn: `${cell.col + 1} / span ${cell.colSpan}`,
  }
}

function cellHasImage(index: number): boolean {
  const id = collage.cellImages[index]?.imageId
  return Boolean(id && registry.get(id))
}

function clearCellSelection(): void {
  collage.selectCell(null)
}

function onCellClick(index: number): void {
  collage.selectCell(index)
  // Empty cell → file picker (multi fills forward through empties)
  if (!cellHasImage(index)) {
    openCellPicker(index)
  }
}

function openCellPicker(index: number): void {
  pendingCellUploadIndex.value = index
  cellFileInput.value?.click()
}

async function onCellFilesSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const start = pendingCellUploadIndex.value
  pendingCellUploadIndex.value = null
  const files = imageFilesFromList(input.files)
  input.value = ''
  if (start === null || !files.length || !collage.layout) return
  const added = await registry.addFiles(files)
  assignImagesFromIndex(
    collage.cellImages,
    added.map((img) => img.id),
    start,
    (i, id) => collage.assignImage(i, id),
  )
}

function onCellDragOver(event: DragEvent): void {
  if (!isFileDrag(event.dataTransfer)) return
  event.preventDefault()
  event.stopPropagation()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
}

async function onCellDrop(event: DragEvent, index: number): Promise<void> {
  if (!isFileDrag(event.dataTransfer)) return
  event.preventDefault()
  event.stopPropagation()
  collage.selectCell(index)
  const files = imageFilesFromList(event.dataTransfer?.files)
  if (!files.length || !collage.layout) return
  const added = await registry.addFiles(files)
  assignImagesFromIndex(
    collage.cellImages,
    added.map((img) => img.id),
    index,
    (i, id) => collage.assignImage(i, id),
  )
}

function replaceCellImage(event: Event, index: number): void {
  event.stopPropagation()
  event.preventDefault()
  collage.selectCell(index)
  openCellPicker(index)
}

function clearCellImage(event: Event, index: number): void {
  event.stopPropagation()
  event.preventDefault()
  collage.selectCell(index)
  collage.clearCellImage(index)
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
  if (gutterDrag.value) return
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

function onGutterPointerDown(event: PointerEvent, axis: 'row' | 'col', gutterIndex: number): void {
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

function onPointerMove(event: PointerEvent): void {
  if (gutterDrag.value && gridEl.value) {
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
    return
  }
  if (!panDrag.value) return
  const dx = event.clientX - panDrag.value.startX
  const dy = event.clientY - panDrag.value.startY
  // Invert delta: object-position % moves opposite to content — drag should follow finger
  livePan[panDrag.value.index] = {
    x: clamp(panDrag.value.originX - dx * 0.15, 0, 100),
    y: clamp(panDrag.value.originY - dy * 0.15, 0, 100),
  }
}

function onPointerUp(event: PointerEvent, index: number): void {
  if (gutterDrag.value) {
    finishGutterDrag()
    return
  }
  if (panDrag.value) {
    const final = livePan[panDrag.value.index]
    if (final) {
      collage.panCell(panDrag.value.index, final)
      delete livePan[panDrag.value.index]
    }
    panDrag.value = null
    return
  }
  if (dragSwap.value && dragSwap.value.from !== index) {
    collage.swapCells(dragSwap.value.from, index)
  }
  dragSwap.value = null
  void event
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

function onPointerCancel(): void {
  if (gutterDrag.value) {
    liveRowFractions.value = null
    liveColFractions.value = null
    gutterDrag.value = null
  }
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

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

watch(gridEl, (el, _prev, onCleanup) => {
  if (!gridObserver) return
  gridObserver.disconnect()
  if (el) {
    gridObserver.observe(el)
    gridBox.value = { width: el.clientWidth, height: el.clientHeight }
  }
  onCleanup(() => {
    gridObserver?.disconnect()
  })
})

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  if (typeof ResizeObserver !== 'undefined' && stageEl.value) {
    stageObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      stageSize.value = { width, height }
    })
    stageObserver.observe(stageEl.value)
  }
  if (typeof ResizeObserver !== 'undefined') {
    gridObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      gridBox.value = { width, height }
    })
    if (gridEl.value) gridObserver.observe(gridEl.value)
  }
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  stageObserver?.disconnect()
  stageObserver = null
  gridObserver?.disconnect()
  gridObserver = null
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-2">
    <input
      ref="cellFileInput"
      type="file"
      accept="image/*"
      multiple
      class="hidden"
      @change="onCellFilesSelected"
    />
    <div
      ref="stageEl"
      class="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2 py-6"
      @click="clearCellSelection"
    >
      <div v-if="layout" class="relative shadow-lg" :style="canvasBoxStyle">
        <div
          class="absolute inset-0"
          :style="{
            padding: `${style.borders.top}px ${style.borders.right}px ${style.borders.bottom}px ${style.borders.left}px`,
          }"
        >
          <div class="relative h-full w-full">
            <div ref="gridEl" class="grid h-full w-full" :style="gridTemplateStyle">
              <div
                v-for="(cell, index) in layout.cells"
                :key="index"
                class="group relative min-h-0 min-w-0 overflow-hidden bg-slate-200 outline-offset-[-2px] transition"
                :class="[
                  panMode && cellHasImage(index) ? 'cursor-move' : 'cursor-pointer',
                  collage.selectedCellIndex === index
                    ? 'outline outline-2 outline-brand'
                    : 'outline outline-1 outline-transparent hover:outline-brand',
                ]"
                :style="{
                  ...cellGridStyle(cell),
                  borderRadius: `${style.radius}px`,
                }"
                @click.stop="onCellClick(index)"
                @pointerdown="onPointerDown($event, index)"
                @pointermove="onPointerMove"
                @pointerup="onPointerUp($event, index)"
                @pointercancel="onPointerCancel"
                @wheel.prevent="onCellWheel($event, index)"
                @dragover="onCellDragOver"
                @drop="onCellDrop($event, index)"
              >
                <img
                  v-if="cellHasImage(index)"
                  :src="registry.get(collage.cellImages[index]!.imageId!)!.objectUrl"
                  alt=""
                  draggable="false"
                  class="pointer-events-none h-full w-full select-none object-cover"
                  :style="imagePreviewStyle(index)"
                />
                <div
                  v-else
                  class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
                >
                  <!-- Explicit stroke; title only on icon so blank cell area has no tooltip -->
                  <div
                    class="pointer-events-auto"
                    :title="t('collage.emptyCellAdd')"
                    :aria-label="t('collage.emptyCellAdd')"
                    role="img"
                  >
                    <svg
                      width="48"
                      height="48"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="10" stroke="#94a3b8" stroke-width="2.5" />
                      <path
                        d="M8 12h8"
                        stroke="#94a3b8"
                        stroke-width="2.5"
                        stroke-linecap="round"
                      />
                      <path
                        d="M12 8v8"
                        stroke="#94a3b8"
                        stroke-width="2.5"
                        stroke-linecap="round"
                      />
                    </svg>
                  </div>
                </div>
                <CellChrome
                  v-if="cellHasImage(index)"
                  :selected="collage.selectedCellIndex === index"
                  :pan-mode="panMode"
                  :scale-percent="Math.round(scaleFor(index) * 100)"
                  @pan-toggle="togglePanMode"
                  @replace="replaceCellImage($event, index)"
                  @remove="clearCellImage($event, index)"
                  @zoom-in="zoomIn($event, index)"
                  @zoom-out="zoomOut($event, index)"
                  @zoom-reset="zoomReset($event, index)"
                />
              </div>
            </div>
            <!-- Sibling overlay so gutters are not CSS-grid items -->
            <div class="pointer-events-none absolute inset-0 z-10">
              <div
                v-for="g in measuredGutters"
                :key="g.key"
                class="pointer-events-auto absolute bg-transparent hover:bg-brand/30"
                :style="g.style"
                @pointerdown="onGutterPointerDown($event, g.axis, g.index)"
                @pointermove="onPointerMove"
                @pointerup="finishGutterDrag"
                @pointercancel="onPointerCancel"
              />
            </div>
          </div>
        </div>
        <!-- Watermark preview (placements match export drawWatermark) -->
        <div
          v-if="watermarkPreview.items.length"
          class="pointer-events-none absolute inset-0 overflow-hidden"
          aria-hidden="true"
        >
          <!-- Tile: rotate whole lattice about center (export parity) -->
          <div
            v-if="watermarkPreview.mode === 'tile'"
            class="absolute top-1/2 left-1/2"
            :style="{
              opacity: style.watermark.opacity,
              transform: `rotate(${style.watermark.rotation}deg)`,
              fontSize: `${style.watermark.fontSize}px`,
              color: '#000',
            }"
          >
            <span
              v-for="(item, i) in watermarkPreview.items"
              :key="i"
              class="absolute whitespace-nowrap"
              :style="{
                left: `${item.x}px`,
                top: `${item.y}px`,
                transform: 'translate(-50%, -50%)',
              }"
            >
              {{ style.watermark.text }}
            </span>
          </div>
          <!-- Single: one anchored label -->
          <template v-else>
            <div
              v-for="(item, i) in watermarkPreview.items"
              :key="'s-' + i"
              class="absolute whitespace-nowrap"
              :style="{
                left: `${item.x}px`,
                top: `${item.y}px`,
                transform: `translate(-50%, -50%) rotate(${style.watermark.rotation}deg)`,
                fontSize: `${style.watermark.fontSize}px`,
                opacity: style.watermark.opacity,
                color: '#000',
              }"
            >
              {{ style.watermark.text }}
            </div>
          </template>
        </div>
      </div>
      <div
        v-else
        class="rounded-xl border border-dashed border-border bg-surface px-8 py-16 text-center text-ink-muted"
      >
        {{ t('collage.pickLayout') }}
      </div>
    </div>
  </div>
</template>
