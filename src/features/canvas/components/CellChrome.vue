<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Hand, ImagePlus, Trash, ZoomIn, ZoomOut } from '@lucide/vue'

defineProps<{
  selected: boolean
  panMode: boolean
  scalePercent: number
}>()

defineEmits<{
  panToggle: [event: Event]
  replace: [event: Event]
  remove: [event: Event]
  zoomIn: [event: Event]
  zoomOut: [event: Event]
  zoomReset: [event: Event]
}>()

const { t } = useI18n()
</script>

<template>
  <!-- Cell chrome: row1 pan/replace/remove; row2 zoom out | percent | zoom in -->
  <div
    class="absolute top-1 right-1 left-1 z-20 flex flex-col items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
    :class="selected ? '!opacity-100' : ''"
    @pointerdown.stop
    @click.stop
  >
    <div class="flex gap-0.5">
      <button
        type="button"
        class="rounded p-1.5 text-white transition"
        :class="
          panMode
            ? 'bg-brand-solid ring-2 ring-brand ring-offset-1 ring-offset-black/40 hover:bg-brand-solid-hover'
            : 'bg-black/60 hover:bg-black/80'
        "
        :title="t('collage.cellPanToggle')"
        :aria-label="t('collage.cellPanToggle')"
        :aria-pressed="panMode"
        @click="$emit('panToggle', $event)"
      >
        <Hand class="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="rounded bg-black/60 p-1.5 text-white hover:bg-black/80"
        :title="t('collage.cellReplace')"
        :aria-label="t('collage.cellReplace')"
        @click="$emit('replace', $event)"
      >
        <ImagePlus class="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="rounded bg-black/60 p-1.5 text-white hover:bg-rose-700/90"
        :title="t('collage.cellRemoveTitle')"
        :aria-label="t('collage.cellRemoveTitle')"
        @click="$emit('remove', $event)"
      >
        <Trash class="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
    <div class="flex items-center gap-0.5">
      <button
        type="button"
        class="rounded bg-black/60 p-1.5 text-white hover:bg-black/80"
        :title="t('collage.cellZoomOut')"
        :aria-label="t('collage.cellZoomOut')"
        @click="$emit('zoomOut', $event)"
      >
        <ZoomOut class="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="min-w-[2.75rem] rounded bg-black/60 px-1.5 py-1 text-center text-[11px] font-semibold tabular-nums text-white hover:bg-black/80"
        :title="t('collage.cellZoomReset')"
        :aria-label="`${t('collage.cellZoomReset')} ${scalePercent}%`"
        @click="$emit('zoomReset', $event)"
      >
        {{ scalePercent }}%
      </button>
      <button
        type="button"
        class="rounded bg-black/60 p-1.5 text-white hover:bg-black/80"
        :title="t('collage.cellZoomIn')"
        :aria-label="t('collage.cellZoomIn')"
        @click="$emit('zoomIn', $event)"
      >
        <ZoomIn class="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
