<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Ellipsis } from '@lucide/vue'
import CellChromeActions from './CellChromeActions.vue'

const props = defineProps<{
  selected: boolean
  panMode: boolean
  scalePercent: number
}>()

const emit = defineEmits<{
  select: [event: Event]
  panToggle: [event: Event]
  rotate: [event: Event]
  flipHorizontal: [event: Event]
  flipVertical: [event: Event]
  remove: [event: Event]
  zoomIn: [event: Event]
  zoomOut: [event: Event]
  zoomReset: [event: Event]
}>()

const { t } = useI18n()

/** Fine pointer: 5×28 + gaps + inset; 2 rows + inset. Coarse uses larger hit targets. */
const COMPACT_MIN = {
  fine: { w: 160, h: 68 },
  coarse: { w: 204, h: 88 },
} as const

const rootEl = ref<HTMLElement | null>(null)
const moreBtnEl = ref<HTMLElement | null>(null)
const panelEl = ref<HTMLElement | null>(null)
const compact = ref(false)
const menuOpen = ref(false)
const panelStyle = ref<Record<string, string>>({
  top: '0px',
  left: '0px',
})

const btn =
  'inline-flex h-7 w-7 items-center justify-center rounded bg-black/60 p-0 text-white hover:bg-black/80 pointer-coarse:h-9 pointer-coarse:w-9'

const chromeVisibleClass = computed(() =>
  props.selected || menuOpen.value ? '!pointer-events-auto !opacity-100' : '',
)

let resizeObserver: ResizeObserver | null = null
let coarseMq: MediaQueryList | null = null

function isCoarsePointer(): boolean {
  return Boolean(coarseMq?.matches)
}

function measureCompact(width: number, height: number): boolean {
  const min = isCoarsePointer() ? COMPACT_MIN.coarse : COMPACT_MIN.fine
  return width < min.w || height < min.h
}

function updateCompactFromCell(): void {
  const cell = rootEl.value?.parentElement
  if (!cell) return
  const { width, height } = cell.getBoundingClientRect()
  const next = measureCompact(width, height)
  if (compact.value !== next) {
    compact.value = next
    if (!next) closeMenu()
  }
}

function closeMenu(): void {
  menuOpen.value = false
}

function positionPanel(): void {
  const trigger = moreBtnEl.value
  if (!trigger) return
  const r = trigger.getBoundingClientRect()
  const gap = 6
  const margin = 8
  const panel = panelEl.value
  const panelW = panel?.offsetWidth || 200
  const panelH = panel?.offsetHeight || 96

  let top = r.bottom + gap
  // Center panel under trigger (compact ⋯ is top-center, not top-right).
  let left = r.left + (r.width - panelW) / 2
  if (left < margin) left = margin
  if (left + panelW > window.innerWidth - margin) {
    left = Math.max(margin, window.innerWidth - panelW - margin)
  }
  if (top + panelH > window.innerHeight - margin) {
    top = Math.max(margin, r.top - panelH - gap)
  }
  panelStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
  }
}

async function openMenu(event: Event): Promise<void> {
  event.stopPropagation()
  emit('select', event)
  menuOpen.value = true
  await nextTick()
  positionPanel()
  await nextTick()
  positionPanel()
}

function toggleMenu(event: Event): void {
  if (menuOpen.value) {
    event.stopPropagation()
    closeMenu()
    return
  }
  void openMenu(event)
}

function onDocPointerDown(event: PointerEvent): void {
  if (!menuOpen.value) return
  const target = event.target as Node | null
  if (!target) return
  if (moreBtnEl.value?.contains(target)) return
  if (panelEl.value?.contains(target)) return
  closeMenu()
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && menuOpen.value) {
    event.preventDefault()
    closeMenu()
  }
}

function onViewportChange(): void {
  updateCompactFromCell()
  if (menuOpen.value) positionPanel()
}

function onCoarseChange(): void {
  updateCompactFromCell()
}

function relay(
  name:
    | 'panToggle'
    | 'rotate'
    | 'flipHorizontal'
    | 'flipVertical'
    | 'remove'
    | 'zoomIn'
    | 'zoomOut'
    | 'zoomReset',
  event: Event,
): void {
  emit(name, event)
}

watch(
  () => props.selected,
  (selected) => {
    if (!selected) closeMenu()
  },
)

onMounted(() => {
  coarseMq = window.matchMedia('(pointer: coarse)')
  coarseMq.addEventListener('change', onCoarseChange)

  const cell = rootEl.value?.parentElement
  if (cell) {
    resizeObserver = new ResizeObserver(() => {
      updateCompactFromCell()
      if (menuOpen.value) positionPanel()
    })
    resizeObserver.observe(cell)
    updateCompactFromCell()
  }

  document.addEventListener('pointerdown', onDocPointerDown, true)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('resize', onViewportChange)
  window.addEventListener('scroll', onViewportChange, true)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  coarseMq?.removeEventListener('change', onCoarseChange)
  document.removeEventListener('pointerdown', onDocPointerDown, true)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('resize', onViewportChange)
  window.removeEventListener('scroll', onViewportChange, true)
})
</script>

<template>
  <!--
    Full chrome when the cell container is large enough; otherwise a ⋯ trigger
    opens a teleported floating panel (does not steal stage real estate when closed).
    Parent cell uses [container-type:size]; we observe that box for compact thresholds.
    Compact ⋯ sits top-center so overflow-hidden + border-radius does not clip it.
  -->
  <div
    ref="rootEl"
    class="absolute top-1 right-1 left-1 z-20 flex flex-col items-center gap-0.5 pointer-events-none opacity-0 transition-opacity pointer-fine:group-hover:pointer-events-auto pointer-fine:group-hover:opacity-100"
    :class="chromeVisibleClass"
    data-cell-chrome
    @pointerdown.stop="emit('select', $event)"
    @click.stop
  >
    <!-- Compact: single more button (top-center) -->
    <div v-if="compact" class="flex w-full justify-center">
      <button
        ref="moreBtnEl"
        type="button"
        :class="[
          btn,
          menuOpen
            ? '!bg-brand-solid ring-2 ring-brand ring-offset-1 ring-offset-black/40 hover:!bg-brand-solid-hover'
            : '',
        ]"
        :title="t('collage.cellMoreActions')"
        :aria-label="t('collage.cellMoreActions')"
        :aria-expanded="menuOpen"
        :aria-haspopup="true"
        @click="toggleMenu($event)"
      >
        <Ellipsis class="h-4 w-4" aria-hidden="true" />
      </button>
    </div>

    <!-- Full in-cell chrome -->
    <CellChromeActions
      v-else
      :pan-mode="panMode"
      :scale-percent="scalePercent"
      @pan-toggle="relay('panToggle', $event)"
      @rotate="relay('rotate', $event)"
      @flip-horizontal="relay('flipHorizontal', $event)"
      @flip-vertical="relay('flipVertical', $event)"
      @remove="relay('remove', $event)"
      @zoom-in="relay('zoomIn', $event)"
      @zoom-out="relay('zoomOut', $event)"
      @zoom-reset="relay('zoomReset', $event)"
    />
  </div>

  <Teleport to="body">
    <div
      v-if="menuOpen && compact"
      ref="panelEl"
      class="fixed z-[80] flex flex-col items-center gap-0.5 rounded-lg border border-white/10 bg-black/80 p-1.5 shadow-xl backdrop-blur-sm"
      role="menu"
      :aria-label="t('collage.cellActionsMenu')"
      :style="panelStyle"
      @pointerdown.stop
      @click.stop
    >
      <CellChromeActions
        as-menu
        :pan-mode="panMode"
        :scale-percent="scalePercent"
        @pan-toggle="relay('panToggle', $event)"
        @rotate="relay('rotate', $event)"
        @flip-horizontal="relay('flipHorizontal', $event)"
        @flip-vertical="relay('flipVertical', $event)"
        @remove="relay('remove', $event)"
        @zoom-in="relay('zoomIn', $event)"
        @zoom-out="relay('zoomOut', $event)"
        @zoom-reset="relay('zoomReset', $event)"
      />
    </div>
  </Teleport>
</template>
