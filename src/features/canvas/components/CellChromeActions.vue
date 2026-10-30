<script setup lang="ts">
import { computed } from 'vue'
import { FlipHorizontal, FlipVertical, Hand, RotateCw, Trash, ZoomIn, ZoomOut } from '@lucide/vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  panMode: boolean
  scalePercent: number
  /** When true, buttons get role="menuitem" for the floating menu. */
  asMenu?: boolean
}>()

const emit = defineEmits<{
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

/** In-cell chrome: dark translucent chips over the photo. */
const btnInCell =
  'inline-flex h-7 w-7 items-center justify-center rounded bg-black/60 p-0 text-white hover:bg-black/80 pointer-coarse:h-9 pointer-coarse:w-9'
const btnDangerInCell =
  'inline-flex h-7 w-7 items-center justify-center rounded bg-black/60 p-0 text-white hover:bg-rose-700/90 pointer-coarse:h-9 pointer-coarse:w-9'
const zoomLabelBtnInCell =
  'inline-flex h-7 min-w-[2.75rem] items-center justify-center rounded bg-black/60 px-1.5 text-center text-[11px] font-semibold leading-none tabular-nums text-white hover:bg-black/80 pointer-coarse:h-9 pointer-coarse:min-w-[3.25rem] pointer-coarse:text-xs'

/**
 * Floating menu (panel is bg-black/80): dedicated hover/active contrast.
 * Do not reuse hover:bg-black/80 — it matches the panel and disappears.
 */
const btnMenu =
  'inline-flex h-7 w-7 items-center justify-center rounded bg-white/10 p-0 text-white hover:bg-white/20 active:bg-white/25 pointer-coarse:h-9 pointer-coarse:w-9'
const btnDangerMenu =
  'inline-flex h-7 w-7 items-center justify-center rounded bg-white/10 p-0 text-white hover:bg-rose-700/90 active:bg-rose-700 pointer-coarse:h-9 pointer-coarse:w-9'
const zoomLabelBtnMenu =
  'inline-flex h-7 min-w-[2.75rem] items-center justify-center rounded bg-white/10 px-1.5 text-center text-[11px] font-semibold leading-none tabular-nums text-white hover:bg-white/20 active:bg-white/25 pointer-coarse:h-9 pointer-coarse:min-w-[3.25rem] pointer-coarse:text-xs'

const btn = computed(() => (props.asMenu ? btnMenu : btnInCell))
const btnDanger = computed(() => (props.asMenu ? btnDangerMenu : btnDangerInCell))
const zoomLabelBtn = computed(() => (props.asMenu ? zoomLabelBtnMenu : zoomLabelBtnInCell))
</script>

<template>
  <div class="flex flex-wrap justify-center gap-0.5">
    <button
      type="button"
      :role="asMenu ? 'menuitem' : undefined"
      :class="[
        btn,
        panMode
          ? '!bg-brand-solid ring-2 ring-brand ring-offset-1 ring-offset-black/40 hover:!bg-brand-solid-hover'
          : '',
      ]"
      :title="t('collage.cellPanToggle')"
      :aria-label="t('collage.cellPanToggle')"
      :aria-pressed="panMode"
      @click="emit('panToggle', $event)"
    >
      <Hand class="h-4 w-4" aria-hidden="true" />
    </button>
    <button
      type="button"
      :role="asMenu ? 'menuitem' : undefined"
      :class="btn"
      :title="t('collage.cellRotateCw')"
      :aria-label="t('collage.cellRotateCw')"
      @click="emit('rotate', $event)"
    >
      <RotateCw class="h-4 w-4" aria-hidden="true" />
    </button>
    <button
      type="button"
      :role="asMenu ? 'menuitem' : undefined"
      :class="btn"
      :title="t('collage.cellFlipHorizontal')"
      :aria-label="t('collage.cellFlipHorizontal')"
      @click="emit('flipHorizontal', $event)"
    >
      <FlipHorizontal class="h-4 w-4" aria-hidden="true" />
    </button>
    <button
      type="button"
      :role="asMenu ? 'menuitem' : undefined"
      :class="btn"
      :title="t('collage.cellFlipVertical')"
      :aria-label="t('collage.cellFlipVertical')"
      @click="emit('flipVertical', $event)"
    >
      <FlipVertical class="h-4 w-4" aria-hidden="true" />
    </button>
    <button
      type="button"
      :role="asMenu ? 'menuitem' : undefined"
      :class="btnDanger"
      :title="t('collage.cellRemove')"
      :aria-label="t('collage.cellRemove')"
      @click="emit('remove', $event)"
    >
      <Trash class="h-4 w-4" aria-hidden="true" />
    </button>
  </div>
  <div class="flex items-center gap-0.5">
    <button
      type="button"
      :role="asMenu ? 'menuitem' : undefined"
      :class="btn"
      :title="t('collage.cellZoomOut')"
      :aria-label="t('collage.cellZoomOut')"
      @click="emit('zoomOut', $event)"
    >
      <ZoomOut class="h-4 w-4" aria-hidden="true" />
    </button>
    <button
      type="button"
      :role="asMenu ? 'menuitem' : undefined"
      :class="zoomLabelBtn"
      :title="t('collage.cellZoomReset')"
      :aria-label="`${t('collage.cellZoomReset')} ${scalePercent}%`"
      @click="emit('zoomReset', $event)"
    >
      {{ scalePercent }}%
    </button>
    <button
      type="button"
      :role="asMenu ? 'menuitem' : undefined"
      :class="btn"
      :title="t('collage.cellZoomIn')"
      :aria-label="t('collage.cellZoomIn')"
      @click="emit('zoomIn', $event)"
    >
      <ZoomIn class="h-4 w-4" aria-hidden="true" />
    </button>
  </div>
</template>
