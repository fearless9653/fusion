<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { WATERMARK_TEXT_MAX_LENGTH } from '@/entities/session'
import { useCollageStore } from '@/features/canvas'
import { LabeledRange, PanelSection } from '@/shared/ui'
import {
  STYLE_PANEL_WATERMARK_OPEN_KEY,
  readStylePanelSectionOpen,
  writeStylePanelSectionOpen,
} from '@/features/canvas/stylePanelSectionCollapse'

const sectionOpen = readStylePanelSectionOpen(STYLE_PANEL_WATERMARK_OPEN_KEY, false)

const { t } = useI18n()
const collage = useCollageStore()
const style = computed(() => collage.style)

const watermarkPositions = [
  {
    id: 'top-left' as const,
    key: 'watermarkPosTopLeft',
    kind: 'corner' as const,
    transform: undefined as string | undefined,
  },
  {
    id: 'top-right' as const,
    key: 'watermarkPosTopRight',
    kind: 'corner' as const,
    transform: 'scaleX(-1)',
  },
  {
    id: 'center' as const,
    key: 'watermarkPosCenter',
    kind: 'center' as const,
    transform: undefined as string | undefined,
  },
  {
    id: 'bottom-left' as const,
    key: 'watermarkPosBottomLeft',
    kind: 'corner' as const,
    transform: 'scaleY(-1)',
  },
  {
    id: 'bottom-right' as const,
    key: 'watermarkPosBottomRight',
    kind: 'corner' as const,
    transform: 'scale(-1, -1)',
  },
]

/** Visual order for 3×3 position grid (middle edge cells empty). */
const watermarkPositionSlots: Array<(typeof watermarkPositions)[number] | null> = [
  watermarkPositions[0]!, // TL
  null,
  watermarkPositions[1]!, // TR
  null,
  watermarkPositions[2]!, // Center
  null,
  watermarkPositions[3]!, // BL
  null,
  watermarkPositions[4]!, // BR
]

function patchWatermark(partial: Partial<typeof style.value.watermark>): void {
  const next = { ...partial }
  if (typeof next.text === 'string') {
    next.text = next.text.slice(0, WATERMARK_TEXT_MAX_LENGTH)
  }
  collage.setStyle({ watermark: { ...style.value.watermark, ...next } })
}
</script>

<template>
  <PanelSection
    :title="t('collage.watermark')"
    :initially-open="sectionOpen"
    @toggle="(open) => writeStylePanelSectionOpen(STYLE_PANEL_WATERMARK_OPEN_KEY, open)"
  >
    <label class="flex items-center justify-between text-xs">
      <span>{{ t('collage.watermarkEnabled') }}</span>
      <input
        type="checkbox"
        :checked="style.watermark.enabled"
        @change="patchWatermark({ enabled: ($event.target as HTMLInputElement).checked })"
      />
    </label>
    <label class="block text-xs text-ink-muted">
      {{ t('collage.watermarkText') }}
      <input
        type="text"
        class="mt-1 w-full rounded border border-border bg-surface px-2 py-1 text-ink"
        :maxlength="WATERMARK_TEXT_MAX_LENGTH"
        :value="style.watermark.text"
        @change="patchWatermark({ text: ($event.target as HTMLInputElement).value })"
      />
    </label>
    <LabeledRange
      :label="t('collage.watermarkFontSize')"
      :model-value="style.watermark.fontSize"
      :min="12"
      :max="100"
      @update:model-value="(v) => patchWatermark({ fontSize: v })"
    />
    <LabeledRange
      :label="t('collage.watermarkOpacity')"
      :model-value="style.watermark.opacity"
      :min="0.05"
      :max="1"
      :step="0.05"
      @update:model-value="(v) => patchWatermark({ opacity: v })"
    />
    <LabeledRange
      :label="t('collage.watermarkRotation')"
      :model-value="style.watermark.rotation"
      :min="-90"
      :max="90"
      :step="5"
      suffix="°"
      @update:model-value="(v) => patchWatermark({ rotation: v })"
    />
    <div>
      <div class="mb-1 text-xs text-ink-muted">{{ t('collage.watermarkMode') }}</div>
      <div class="grid grid-cols-2 gap-1">
        <button
          type="button"
          class="rounded border px-1 py-1.5 text-xs"
          :class="
            style.watermark.mode === 'tile'
              ? 'border-brand bg-brand/10 text-brand-fg'
              : 'border-border hover:bg-surface-muted'
          "
          @click="patchWatermark({ mode: 'tile' })"
        >
          {{ t('collage.watermarkModeTile') }}
        </button>
        <button
          type="button"
          class="rounded border px-1 py-1.5 text-xs"
          :class="
            style.watermark.mode === 'single'
              ? 'border-brand bg-brand/10 text-brand-fg'
              : 'border-border hover:bg-surface-muted'
          "
          @click="patchWatermark({ mode: 'single' })"
        >
          {{ t('collage.watermarkModeSingle') }}
        </button>
      </div>
    </div>
    <div v-if="style.watermark.mode === 'tile'">
      <div class="mb-1 text-xs text-ink-muted">{{ t('collage.watermarkDensity') }}</div>
      <div class="grid grid-cols-3 gap-1">
        <button
          v-for="d in [
            { n: 1, key: 'sparse' },
            { n: 2, key: 'medium' },
            { n: 4, key: 'dense' },
          ]"
          :key="d.n"
          type="button"
          class="rounded border px-1 py-1.5 text-xs"
          :class="
            style.watermark.density === d.n
              ? 'border-brand bg-brand/10 text-brand-fg'
              : 'border-border hover:bg-surface-muted'
          "
          @click="patchWatermark({ density: d.n })"
        >
          {{ t(`collage.density.${d.key}`) }}
        </button>
      </div>
    </div>
    <div v-else>
      <div class="mb-1 text-xs text-ink-muted">{{ t('collage.watermarkPosition') }}</div>
      <div class="grid grid-cols-3 gap-1">
        <template v-for="(slot, slotIndex) in watermarkPositionSlots" :key="slotIndex">
          <button
            v-if="slot"
            type="button"
            class="inline-flex items-center justify-center rounded border p-1.5 text-ink-muted hover:bg-surface-muted"
            :class="
              style.watermark.position === slot.id
                ? 'border-brand bg-brand/10 text-brand-fg'
                : 'border-border'
            "
            :title="t(`collage.${slot.key}`)"
            :aria-label="t(`collage.${slot.key}`)"
            :aria-pressed="style.watermark.position === slot.id"
            @click="patchWatermark({ position: slot.id })"
          >
            <!-- Center: frame + middle dot -->
            <svg
              v-if="slot.kind === 'center'"
              class="h-4 w-4"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <rect
                x="1.5"
                y="1.5"
                width="13"
                height="13"
                rx="1.5"
                stroke="currentColor"
                stroke-width="1.5"
              />
              <circle cx="8" cy="8" r="2" fill="currentColor" />
            </svg>
            <!-- Corner: frame + TL mark; flipped for other corners -->
            <svg
              v-else
              class="h-4 w-4"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              :style="slot.transform ? { transform: slot.transform } : undefined"
            >
              <rect
                x="1.5"
                y="1.5"
                width="13"
                height="13"
                rx="1.5"
                stroke="currentColor"
                stroke-width="1.5"
              />
              <rect x="3.5" y="3.5" width="4" height="4" rx="0.75" fill="currentColor" />
            </svg>
          </button>
          <div v-else class="min-h-8" aria-hidden="true" />
        </template>
      </div>
    </div>
  </PanelSection>
</template>
