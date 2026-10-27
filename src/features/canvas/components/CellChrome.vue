<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { FlipHorizontal, FlipVertical, Hand, RotateCw, Trash, ZoomIn, ZoomOut } from '@lucide/vue'

defineProps<{
  selected: boolean
  panMode: boolean
  scalePercent: number
}>()

defineEmits<{
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

const btn =
  'inline-flex h-7 w-7 items-center justify-center rounded bg-black/60 p-0 text-white hover:bg-black/80 pointer-coarse:h-9 pointer-coarse:w-9'
const btnDanger =
  'inline-flex h-7 w-7 items-center justify-center rounded bg-black/60 p-0 text-white hover:bg-rose-700/90 pointer-coarse:h-9 pointer-coarse:w-9'
</script>

<template>
  <!-- Cell chrome: row1 pan/rotate/flips/remove; row2 zoom out | percent | zoom in -->
  <div
    class="absolute top-1 right-1 left-1 z-20 flex flex-col items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
    :class="selected ? '!opacity-100' : ''"
    @pointerdown.stop
    @click.stop
  >
    <div class="flex flex-wrap justify-center gap-0.5">
      <button
        type="button"
        :class="[
          btn,
          panMode
            ? '!bg-brand-solid ring-2 ring-brand ring-offset-1 ring-offset-black/40 hover:!bg-brand-solid-hover'
            : '',
        ]"
        :title="t('collage.cellPanToggle')"
        :aria-label="t('collage.cellPanToggle')"
        :aria-pressed="panMode"
        @click="$emit('panToggle', $event)"
      >
        <Hand class="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        :class="btn"
        :title="t('collage.cellRotateCw')"
        :aria-label="t('collage.cellRotateCw')"
        @click="$emit('rotate', $event)"
      >
        <RotateCw class="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        :class="btn"
        :title="t('collage.cellFlipHorizontal')"
        :aria-label="t('collage.cellFlipHorizontal')"
        @click="$emit('flipHorizontal', $event)"
      >
        <FlipHorizontal class="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        :class="btn"
        :title="t('collage.cellFlipVertical')"
        :aria-label="t('collage.cellFlipVertical')"
        @click="$emit('flipVertical', $event)"
      >
        <FlipVertical class="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        :class="btnDanger"
        :title="t('collage.cellRemove')"
        :aria-label="t('collage.cellRemove')"
        @click="$emit('remove', $event)"
      >
        <Trash class="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
    <div class="flex items-center gap-0.5">
      <button
        type="button"
        :class="btn"
        :title="t('collage.cellZoomOut')"
        :aria-label="t('collage.cellZoomOut')"
        @click="$emit('zoomOut', $event)"
      >
        <ZoomOut class="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="inline-flex h-7 min-w-[2.75rem] items-center justify-center rounded bg-black/60 px-1.5 text-center text-[11px] font-semibold leading-none tabular-nums text-white hover:bg-black/80 pointer-coarse:h-9 pointer-coarse:min-w-[3.25rem] pointer-coarse:text-xs"
        :title="t('collage.cellZoomReset')"
        :aria-label="`${t('collage.cellZoomReset')} ${scalePercent}%`"
        @click="$emit('zoomReset', $event)"
      >
        {{ scalePercent }}%
      </button>
      <button
        type="button"
        :class="btn"
        :title="t('collage.cellZoomIn')"
        :aria-label="t('collage.cellZoomIn')"
        @click="$emit('zoomIn', $event)"
      >
        <ZoomIn class="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
