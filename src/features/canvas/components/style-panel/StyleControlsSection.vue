<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCollageStore } from '@/features/canvas'
import { useImageRegistry } from '@/features/images'
import { LabeledRange, PanelSection } from '@/shared/ui'
import {
  STYLE_PANEL_STYLE_OPEN_KEY,
  readStylePanelSectionOpen,
  writeStylePanelSectionOpen,
} from '@/features/canvas/stylePanelSectionCollapse'

const sectionOpen = readStylePanelSectionOpen(STYLE_PANEL_STYLE_OPEN_KEY, false)

const { t } = useI18n()
const collage = useCollageStore()
const registry = useImageRegistry()
const bgInput = ref<HTMLInputElement | null>(null)
const style = computed(() => collage.style)

const BORDER_SIDE_GLYPH: Record<'top' | 'right' | 'bottom' | 'left', string> = {
  top: '↑',
  right: '→',
  bottom: '↓',
  left: '←',
}

function setSpacing(v: number): void {
  collage.setStyle({ spacing: v })
}
function setRadius(v: number): void {
  collage.setStyle({ radius: v })
}
function setBorder(side: 'top' | 'right' | 'bottom' | 'left', v: number): void {
  collage.setStyle({ borders: { ...style.value.borders, [side]: Math.max(0, v) } })
}
function setBgColor(color: string): void {
  collage.setStyle({ background: { ...style.value.background, color } })
}

async function onBgUpload(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const prevId = style.value.background.imageId
  const added = await registry.addFile(file)
  collage.setStyle({ background: { ...style.value.background, imageId: added.id } })
  if (prevId && prevId !== added.id) registry.remove(prevId)
}
function removeBg(): void {
  const prevId = style.value.background.imageId
  collage.setStyle({ background: { ...style.value.background, imageId: null } })
  if (prevId) registry.remove(prevId)
}
</script>

<template>
  <PanelSection
    :title="t('collage.style')"
    :initially-open="sectionOpen"
    @toggle="(open) => writeStylePanelSectionOpen(STYLE_PANEL_STYLE_OPEN_KEY, open)"
  >
    <LabeledRange
      :label="t('collage.spacing')"
      :model-value="style.spacing"
      :min="0"
      :max="80"
      suffix="px"
      @update:model-value="setSpacing"
    />
    <LabeledRange
      :label="t('collage.radius')"
      :model-value="style.radius"
      :min="0"
      :max="80"
      suffix="px"
      @update:model-value="setRadius"
    />
    <div>
      <div class="mb-1 text-xs text-ink-muted">{{ t('collage.borders') }}</div>
      <div class="grid grid-cols-4 gap-1">
        <label
          v-for="side in ['top', 'right', 'bottom', 'left'] as const"
          :key="side"
          class="text-center text-[12px] text-ink-muted"
        >
          <span class="block font-medium" aria-hidden="true">{{ BORDER_SIDE_GLYPH[side] }}</span>
          <input
            type="number"
            min="0"
            class="mt-0.5 w-full rounded border border-border bg-surface px-1 py-1 text-center text-xs text-ink"
            :value="style.borders[side]"
            :aria-label="side"
            @change="setBorder(side, Number(($event.target as HTMLInputElement).value) || 0)"
          />
        </label>
      </div>
    </div>
    <label class="block text-xs text-ink-muted">
      {{ t('collage.bgColor') }}
      <input
        type="color"
        class="mt-1 h-8 w-full cursor-pointer rounded border border-border"
        :value="style.background.color"
        @input="setBgColor(($event.target as HTMLInputElement).value)"
      />
    </label>
    <div class="flex gap-2">
      <button
        type="button"
        class="flex-1 rounded border border-border px-2 py-1.5 text-xs hover:bg-surface-muted"
        @click="bgInput?.click()"
      >
        {{ t('collage.bgUpload') }}
      </button>
      <button
        type="button"
        class="flex-1 rounded border border-border px-2 py-1.5 text-xs hover:bg-surface-muted disabled:opacity-40"
        :disabled="!style.background.imageId"
        @click="removeBg"
      >
        {{ t('collage.bgRemove') }}
      </button>
      <input ref="bgInput" type="file" accept="image/*" class="hidden" @change="onBgUpload" />
    </div>
  </PanelSection>
</template>
