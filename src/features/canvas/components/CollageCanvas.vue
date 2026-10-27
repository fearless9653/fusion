<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CellChrome from '@/features/canvas/components/CellChrome.vue'
import { useGutterDrag } from '@/features/canvas/composables/useGutterDrag'
import { useCellPointerInteractions } from '@/features/canvas/composables/useCellPointerInteractions'
import { useWatermarkPreview } from '@/features/canvas/composables/useWatermarkPreview'
import { useCollageStore } from '@/features/canvas'
import {
  assignImagesFromIndex,
  imageFilesFromList,
  isFileDrag,
  useImageRegistry,
} from '@/features/images'
import { fitAspectRect, fractionsToCssTemplate } from '@/shared/lib'
import { showToast } from '@/shared/ui'

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

const layout = computed(() => collage.layout)
const style = computed(() => collage.style)

const gutter = useGutterDrag({ collage, layout, style, gridEl, gridBox })
const {
  gutterDrag,
  displayRowFractions,
  displayColFractions,
  measuredGutters,
  onGutterPointerDown,
  onGutterPointerMove,
  finishGutterDrag,
  cancelGutterDrag,
} = gutter

const isGutterDragging = computed(() => gutterDrag.value !== null)

const cellPtr = useCellPointerInteractions({
  collage,
  registry,
  isGutterDragging,
})
const {
  panMode,
  cellHasImage,
  scaleFor,
  imagePreviewStyle,
  onPointerDown,
  onPanPointerMove,
  onPointerUp: onCellPointerUp,
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
} = cellPtr

const hasAnyCellImage = computed(() => collage.cellImages.some((c) => c.imageId !== null))

function clearAllImages(): void {
  if (!hasAnyCellImage.value) return
  collage.clearAllCellImages()
  showToast(t('collage.clearAllImagesDone'), 'info')
}

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

const watermarkPreview = useWatermarkPreview(style, canvasSize)

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

function cellGridStyle(cell: { row: number; col: number; rowSpan: number; colSpan: number }) {
  return {
    gridRow: `${cell.row + 1} / span ${cell.rowSpan}`,
    gridColumn: `${cell.col + 1} / span ${cell.colSpan}`,
  }
}

function clearCellSelection(): void {
  collage.selectCell(null)
}

function onCellClick(index: number): void {
  // After a pan/swap drag, pointerup is followed by click on the capture target —
  // do not open the empty-cell file picker in that case.
  if (consumeClickSuppression()) return
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
  // Re-assert selection after OS file dialog (dismiss click may have cleared it).
  collage.selectCell(start)
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

function clearCellImage(event: Event, index: number): void {
  event.stopPropagation()
  event.preventDefault()
  collage.selectCell(index)
  collage.clearCellImage(index)
}

function onPointerMove(event: PointerEvent): void {
  if (onGutterPointerMove(event)) return
  onPanPointerMove(event)
}

function onPointerUp(event: PointerEvent, index: number): void {
  if (gutterDrag.value) {
    finishGutterDrag()
    return
  }
  onCellPointerUp(event, index)
}

function onPointerCancel(): void {
  cancelGutterDrag()
  cancelCellPointer()
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
    <div class="flex shrink-0 items-center justify-end gap-2 px-2 pt-1">
      <button
        type="button"
        class="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-muted hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-40"
        :disabled="!hasAnyCellImage"
        :title="t('collage.clearAllImages')"
        :aria-label="t('collage.clearAllImages')"
        @click="clearAllImages"
      >
        {{ t('collage.clearAllImages') }}
      </button>
    </div>
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
                class="group relative min-h-0 min-w-0 touch-none overflow-hidden bg-slate-200 transition [container-type:size]"
                :class="panMode && cellHasImage(index) ? 'cursor-move' : 'cursor-pointer'"
                :data-cell-index="index"
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
                <!-- Above scaled img (transform stacking covers ancestor outline); below CellChrome z-20 -->
                <div
                  class="pointer-events-none absolute inset-0 z-[15] rounded-[inherit] ring-inset transition"
                  :class="
                    collage.selectedCellIndex === index
                      ? 'ring-2 ring-brand'
                      : 'ring-1 ring-transparent group-hover:ring-brand'
                  "
                  aria-hidden="true"
                />
                <CellChrome
                  v-if="cellHasImage(index)"
                  :selected="collage.selectedCellIndex === index"
                  :pan-mode="panMode"
                  :scale-percent="Math.round(scaleFor(index) * 100)"
                  @select="collage.selectCell(index)"
                  @pan-toggle="togglePanMode"
                  @rotate="rotateCw($event, index)"
                  @flip-horizontal="flipHorizontal($event, index)"
                  @flip-vertical="flipVertical($event, index)"
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
                class="pointer-events-auto absolute touch-none bg-transparent hover:bg-brand/30 active:bg-brand/30"
                :class="
                  gutterDrag && gutterDrag.axis === g.axis && gutterDrag.gutterIndex === g.index
                    ? '!bg-brand/30'
                    : ''
                "
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
