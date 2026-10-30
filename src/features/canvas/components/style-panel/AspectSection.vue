<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowLeftRight } from '@lucide/vue'
import { ASPECT_SIDE_MAX, ASPECT_SIDE_MIN, clampAspectSide } from '@/entities/session'
import { useCollageStore } from '@/features/canvas'
import {
  ASPECT_RATIO_PRESETS,
  PORTRAIT_PRINT_SIZE_PRESETS,
  getPairedPrintSizeId,
  getPrintSizePreset,
  isSamePrintSizePair,
} from '@/features/export'
import { PanelSection } from '@/shared/ui'
import {
  STYLE_PANEL_ASPECT_OPEN_KEY,
  readStylePanelSectionOpen,
  writeStylePanelSectionOpen,
} from '@/features/canvas/stylePanelSectionCollapse'

const sectionOpen = readStylePanelSectionOpen(STYLE_PANEL_ASPECT_OPEN_KEY, true)

const { t } = useI18n()
const collage = useCollageStore()
const style = computed(() => collage.style)

/** Draft only — empty until user types; never synced from preset clicks. */
const customW = ref<number | ''>('')
const customH = ref<number | ''>('')

function isValidPositiveAspect(n: number | ''): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0
}

function clampCustomDraft(n: number): number {
  return clampAspectSide(n)
}

const canApplyCustomAspect = computed(
  () => isValidPositiveAspect(customW.value) && isValidPositiveAspect(customH.value),
)

function setCommonAspect(presetId: string, w: number, h: number): void {
  customW.value = ''
  customH.value = ''
  collage.setAspectRatio(w, h, null, 'common', presetId)
}
function setPrintAspect(w: number, h: number, printId: string): void {
  customW.value = ''
  customH.value = ''
  collage.setAspectRatio(w, h, printId, 'print')
}
function applyCustomAspect(): void {
  if (!isValidPositiveAspect(customW.value) || !isValidPositiveAspect(customH.value)) return
  const w = clampCustomDraft(customW.value)
  const h = clampCustomDraft(customH.value)
  customW.value = w
  customH.value = h
  collage.setAspectRatio(w, h, null, 'custom')
}
function swapAspect(): void {
  const source = style.value.aspectSource
  if (source === 'print') {
    const printId = style.value.printSizeId
    if (!printId) return
    // Flip via paired print preset mm (X ↔ X-L); leave custom draft untouched.
    const pairedId = getPairedPrintSizeId(printId) ?? printId
    const paired = getPrintSizePreset(pairedId)
    if (paired) {
      collage.setAspectRatio(paired.widthMm, paired.heightMm, paired.id, 'print')
    } else {
      const { width: w, height: h } = style.value.aspectRatio
      collage.setAspectRatio(h, w, pairedId, 'print')
    }
    return
  }

  if (source === 'common') {
    // Flip store W/H; keep commonAspectId so the landscape chip stays lit.
    const { width: w, height: h } = style.value.aspectRatio
    collage.setAspectRatio(h, w, null, 'common')
    return
  }

  // custom: swap draft inputs when present; otherwise flip applied store ratio
  if (isValidPositiveAspect(customW.value) && isValidPositiveAspect(customH.value)) {
    const w = clampCustomDraft(customW.value)
    const h = clampCustomDraft(customH.value)
    customW.value = h
    customH.value = w
    collage.setAspectRatio(h, w, null, 'custom')
    return
  }
  const { width: w, height: h } = style.value.aspectRatio
  customW.value = clampCustomDraft(h)
  customH.value = clampCustomDraft(w)
  collage.setAspectRatio(customW.value, customH.value, null, 'custom')
}
</script>

<template>
  <PanelSection
    :title="t('collage.aspect')"
    :initially-open="sectionOpen"
    @toggle="(open) => writeStylePanelSectionOpen(STYLE_PANEL_ASPECT_OPEN_KEY, open)"
  >
    <div>
      <div class="mb-1.5 text-[11px] font-medium tracking-wide text-ink-muted">
        {{ t('collage.aspectCommon') }}
      </div>
      <div class="grid grid-cols-3 gap-1.5">
        <button
          v-for="preset in ASPECT_RATIO_PRESETS"
          :key="preset.id"
          type="button"
          class="rounded border px-1 py-1.5 text-xs"
          :class="
            style.aspectSource === 'common' && style.commonAspectId === preset.id
              ? 'border-brand bg-brand/10 text-brand-fg'
              : 'border-border hover:bg-surface-muted'
          "
          @click="setCommonAspect(preset.id, preset.ratio.width, preset.ratio.height)"
        >
          {{ preset.id }}
        </button>
      </div>
    </div>
    <div>
      <div class="mb-1.5 text-[11px] font-medium tracking-wide text-ink-muted">
        {{ t('collage.aspectPrint') }}
      </div>
      <div class="grid grid-cols-2 gap-1.5">
        <button
          v-for="print in PORTRAIT_PRINT_SIZE_PRESETS"
          :key="print.id"
          type="button"
          class="rounded border px-1 py-1.5 text-center text-xs"
          :class="
            style.aspectSource === 'print' &&
            style.printSizeId &&
            isSamePrintSizePair(style.printSizeId, print.id)
              ? 'border-brand bg-brand/10 text-brand-fg'
              : 'border-border hover:bg-surface-muted'
          "
          @click="setPrintAspect(print.widthMm, print.heightMm, print.id)"
        >
          <span class="block leading-tight font-medium">{{
            t(`collage.printSize.${print.labelKey}`)
          }}</span>
          <span class="mt-0.5 block text-[10px] leading-tight text-ink-muted"
            >{{ print.widthMm }}×{{ print.heightMm }} mm</span
          >
        </button>
      </div>
    </div>
    <div>
      <div class="mb-2 text-[11px] font-medium tracking-wide text-ink-muted">
        {{ t('collage.aspectCustom') }}
      </div>
      <div class="space-y-2.5">
        <label class="flex items-center gap-2 text-xs text-ink-muted">
          <span class="w-6 shrink-0">{{ t('collage.width') }}</span>
          <input
            v-model.number="customW"
            type="number"
            :min="ASPECT_SIDE_MIN"
            :max="ASPECT_SIDE_MAX"
            class="box-border h-9 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 text-sm leading-none text-ink"
          />
        </label>
        <label class="flex items-center gap-2 text-xs text-ink-muted">
          <span class="w-6 shrink-0">{{ t('collage.height') }}</span>
          <input
            v-model.number="customH"
            type="number"
            :min="ASPECT_SIDE_MIN"
            :max="ASPECT_SIDE_MAX"
            class="box-border h-9 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 text-sm leading-none text-ink"
          />
        </label>
        <button
          type="button"
          class="inline-flex h-9 w-full items-center justify-center rounded-md border px-3 text-xs font-medium"
          :class="
            style.aspectSource === 'custom'
              ? 'border-brand bg-brand/10 text-brand-fg'
              : 'border-border bg-surface text-ink-muted hover:bg-brand/10 hover:text-brand-fg'
          "
          :disabled="!canApplyCustomAspect"
          @click="applyCustomAspect"
        >
          {{ t('collage.apply') }}
        </button>
      </div>
    </div>
    <div class="border-t border-border pt-3">
      <button
        type="button"
        class="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-solid px-3 py-2 text-sm font-medium text-white hover:bg-brand-solid-hover"
        :title="t('collage.aspectSwap')"
        :aria-label="t('collage.aspectSwap')"
        @click="swapAspect"
      >
        <ArrowLeftRight class="h-4 w-4" aria-hidden="true" />
        <span>{{ t('collage.aspectSwap') }}</span>
      </button>
    </div>
  </PanelSection>
</template>
