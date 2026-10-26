<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DownloadQuality } from '@/entities/session'
import { useCollageStore } from '@/features/canvas'

defineProps<{
  busy: boolean
}>()

const emit = defineEmits<{
  download: []
  copy: []
}>()

const { t } = useI18n()
const collage = useCollageStore()
const style = computed(() => collage.style)

const qualityOptions: Array<{ id: DownloadQuality; labelKey: string }> = [
  { id: 'medium-jpg', labelKey: 'collage.qualityMedium' },
  { id: 'high-jpg', labelKey: 'collage.qualityHigh' },
  { id: 'png', labelKey: 'collage.qualityPng' },
]

function setQuality(q: DownloadQuality): void {
  collage.setDownloadQuality(q)
}
</script>

<template>
  <footer
    class="shrink-0 border-t border-border bg-surface px-3 py-3"
    :aria-label="t('collage.export')"
  >
    <div class="mb-2 text-sm font-semibold text-ink">{{ t('collage.export') }}</div>
    <div class="space-y-2">
      <div class="grid grid-cols-3 gap-1">
        <button
          v-for="opt in qualityOptions"
          :key="opt.id"
          type="button"
          class="rounded border px-1 py-1.5 text-[11px]"
          :class="
            style.downloadQuality === opt.id
              ? 'border-brand bg-brand/10 text-brand-fg'
              : 'border-border'
          "
          @click="setQuality(opt.id)"
        >
          {{ t(opt.labelKey) }}
        </button>
      </div>
      <button
        type="button"
        class="w-full rounded-md bg-brand-solid px-3 py-2 text-sm font-medium text-white hover:bg-brand-solid-hover disabled:opacity-50"
        :disabled="busy || !collage.layout"
        @click="emit('download')"
      >
        {{ t('collage.download') }}
      </button>
      <button
        type="button"
        class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink-muted hover:bg-brand/10 hover:text-brand-fg disabled:opacity-50"
        :disabled="busy || !collage.layout"
        @click="emit('copy')"
      >
        {{ t('collage.copyClipboard') }}
      </button>
    </div>
  </footer>
</template>
