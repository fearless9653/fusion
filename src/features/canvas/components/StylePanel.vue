<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowLeftRight, Redo2, RotateCcw, Undo2 } from '@lucide/vue'
import type { DownloadQuality } from '@/entities/session'
import { useCollageStore } from '@/features/canvas'
import {
  ASPECT_RATIO_PRESETS,
  PORTRAIT_PRINT_SIZE_PRESETS,
  canvasToBlob,
  copyBlobToClipboard,
  downloadBlob,
  exportFilename,
  getPairedPrintSizeId,
  getPrintSizePreset,
  isSamePrintSizePair,
  jpegQualityFor,
  buildRenderImages,
  renderCollage,
} from '@/features/export'
import { useImageRegistry } from '@/features/images'
import { IconToolbarButton, PanelSection, showToast } from '@/shared/ui'

const { t } = useI18n()
const collage = useCollageStore()
const registry = useImageRegistry()
const busy = ref(false)
const bgInput = ref<HTMLInputElement | null>(null)

const style = computed(() => collage.style)
/** Draft only — empty until user types; never synced from preset clicks. */
const customW = ref<number | ''>('')
const customH = ref<number | ''>('')

function isValidPositiveAspect(n: number | ''): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0
}

const canApplyCustomAspect = computed(
  () => isValidPositiveAspect(customW.value) && isValidPositiveAspect(customH.value),
)

const qualityOptions: Array<{ id: DownloadQuality; labelKey: string }> = [
  { id: 'medium-jpg', labelKey: 'collage.qualityMedium' },
  { id: 'high-jpg', labelKey: 'collage.qualityHigh' },
  { id: 'png', labelKey: 'collage.qualityPng' },
]

const BORDER_SIDE_GLYPH: Record<'top' | 'right' | 'bottom' | 'left', string> = {
  top: '↑',
  right: '→',
  bottom: '↓',
  left: '←',
}

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
  const w = customW.value
  const h = customH.value
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

  // custom: swap applied ratio + sync both inputs; empty draft → no-op
  if (!isValidPositiveAspect(customW.value) || !isValidPositiveAspect(customH.value)) return
  const w = customW.value
  const h = customH.value
  customW.value = h
  customH.value = w
  collage.setAspectRatio(h, w, null, 'custom')
}
function setQuality(q: DownloadQuality): void {
  collage.setDownloadQuality(q)
}
function patchWatermark(partial: Partial<typeof style.value.watermark>): void {
  collage.setStyle({ watermark: { ...style.value.watermark, ...partial } })
}

async function onBgUpload(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const added = await registry.addFile(file)
  collage.setStyle({ background: { ...style.value.background, imageId: added.id } })
}
function removeBg(): void {
  collage.setStyle({ background: { ...style.value.background, imageId: null } })
}

async function ensureExportReady(): Promise<boolean> {
  if (!collage.layout) {
    showToast(t('collage.exportNeedLayout'), 'error')
    return false
  }
  return true
}

async function doRender(): Promise<{ blob: Blob; extension: 'jpg' | 'png' } | null> {
  if (!(await ensureExportReady()) || !collage.layout) return null
  const images = await buildRenderImages(registry.list)
  const rendered = renderCollage({
    layout: collage.layout,
    style: collage.style,
    cellImages: collage.cellImages,
    rowFractions: collage.rowFractions,
    colFractions: collage.colFractions,
    images,
    previewSize: collage.previewFrameSize,
  })
  const quality = jpegQualityFor(collage.style)
  const blob = await canvasToBlob(rendered.canvas, rendered.mimeType, quality)
  return { blob, extension: rendered.extension }
}

async function onDownload(): Promise<void> {
  busy.value = true
  try {
    const result = await doRender()
    if (!result) return
    downloadBlob(result.blob, exportFilename(result.extension))
    showToast(t('collage.exportDownloaded'), 'success')
  } catch (err) {
    showToast(err instanceof Error ? err.message : t('collage.exportFailed'), 'error')
  } finally {
    busy.value = false
  }
}

async function onCopy(): Promise<void> {
  busy.value = true
  try {
    // Clipboard prefers PNG
    if (!collage.layout) {
      showToast(t('collage.exportNeedLayout'), 'error')
      return
    }
    const pngStyle = { ...collage.style, downloadQuality: 'png' as const }
    const images = await buildRenderImages(registry.list)
    const rendered = renderCollage({
      layout: collage.layout,
      style: pngStyle,
      cellImages: collage.cellImages,
      rowFractions: collage.rowFractions,
      colFractions: collage.colFractions,
      images,
      previewSize: collage.previewFrameSize,
    })
    const blob = await canvasToBlob(rendered.canvas, 'image/png')
    const ok = await copyBlobToClipboard(blob)
    if (ok) {
      showToast(t('collage.exportCopied'), 'success')
      return
    }
    downloadBlob(blob, exportFilename('png'))
    showToast(t('collage.exportClipboardFallback'), 'info')
  } catch (err) {
    showToast(err instanceof Error ? err.message : t('collage.exportFailed'), 'error')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="accent-brand flex h-full min-h-0 flex-col text-sm">
    <header
      class="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-surface px-3 py-2.5"
    >
      <h2 class="font-semibold text-ink">{{ t('collage.settings') }}</h2>
      <div class="flex gap-1">
        <IconToolbarButton
          :label="t('collage.undo')"
          :disabled="!collage.undoAvailable"
          @click="collage.undo()"
        >
          <Undo2 class="h-4 w-4" aria-hidden="true" />
        </IconToolbarButton>
        <IconToolbarButton
          :label="t('collage.redo')"
          :disabled="!collage.redoAvailable"
          @click="collage.redo()"
        >
          <Redo2 class="h-4 w-4" aria-hidden="true" />
        </IconToolbarButton>
        <IconToolbarButton :label="t('collage.resetStyles')" @click="collage.resetStyles()">
          <RotateCcw class="h-4 w-4" aria-hidden="true" />
        </IconToolbarButton>
      </div>
    </header>

    <div
      class="panel-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden p-3"
    >
      <PanelSection :title="t('collage.aspect')">
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
            <label class="flex flex-col gap-1 text-xs text-ink-muted">
              {{ t('collage.width') }}
              <input
                v-model.number="customW"
                type="number"
                min="1"
                class="box-border h-9 w-full rounded-md border border-border bg-surface px-2 text-sm leading-none text-ink"
              />
            </label>
            <label class="flex flex-col gap-1 text-xs text-ink-muted">
              {{ t('collage.height') }}
              <input
                v-model.number="customH"
                type="number"
                min="1"
                class="box-border h-9 w-full rounded-md border border-border bg-surface px-2 text-sm leading-none text-ink"
              />
            </label>
            <div class="flex items-stretch gap-2.5">
              <button
                type="button"
                class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-ink-muted hover:bg-brand/10 hover:text-brand-fg"
                :title="t('collage.aspectSwap')"
                :aria-label="t('collage.aspectSwap')"
                @click="swapAspect"
              >
                <ArrowLeftRight class="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                class="inline-flex h-9 min-w-0 flex-1 items-center justify-center rounded-md border px-3 text-xs font-medium"
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
        </div>
      </PanelSection>

      <PanelSection :title="t('collage.style')">
        <label class="block text-xs text-ink-muted">
          {{ t('collage.spacing') }}: {{ style.spacing }}px
          <input
            type="range"
            min="0"
            max="80"
            :value="style.spacing"
            class="mt-1 w-full"
            @input="setSpacing(Number(($event.target as HTMLInputElement).value))"
          />
        </label>
        <label class="block text-xs text-ink-muted">
          {{ t('collage.radius') }}: {{ style.radius }}px
          <input
            type="range"
            min="0"
            max="80"
            :value="style.radius"
            class="mt-1 w-full"
            @input="setRadius(Number(($event.target as HTMLInputElement).value))"
          />
        </label>
        <div>
          <div class="mb-1 text-xs text-ink-muted">{{ t('collage.borders') }}</div>
          <div class="grid grid-cols-4 gap-1">
            <label
              v-for="side in ['top', 'right', 'bottom', 'left'] as const"
              :key="side"
              class="text-center text-[12px] text-ink-muted"
            >
              <span class="block font-medium" aria-hidden="true">{{
                BORDER_SIDE_GLYPH[side]
              }}</span>
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

      <PanelSection :title="t('collage.watermark')" :initially-open="false">
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
            :value="style.watermark.text"
            @change="patchWatermark({ text: ($event.target as HTMLInputElement).value })"
          />
        </label>
        <label class="block text-xs text-ink-muted">
          {{ t('collage.watermarkFontSize') }}: {{ style.watermark.fontSize }}
          <input
            type="range"
            min="12"
            max="100"
            :value="style.watermark.fontSize"
            class="mt-1 w-full"
            @input="patchWatermark({ fontSize: Number(($event.target as HTMLInputElement).value) })"
          />
        </label>
        <label class="block text-xs text-ink-muted">
          {{ t('collage.watermarkOpacity') }}: {{ style.watermark.opacity }}
          <input
            type="range"
            min="0.05"
            max="1"
            step="0.05"
            :value="style.watermark.opacity"
            class="mt-1 w-full"
            @input="patchWatermark({ opacity: Number(($event.target as HTMLInputElement).value) })"
          />
        </label>
        <label class="block text-xs text-ink-muted">
          {{ t('collage.watermarkRotation') }}: {{ style.watermark.rotation }}°
          <input
            type="range"
            min="-90"
            max="90"
            step="5"
            :value="style.watermark.rotation"
            class="mt-1 w-full"
            @input="patchWatermark({ rotation: Number(($event.target as HTMLInputElement).value) })"
          />
        </label>
        <div>
          <div class="mb-1 text-xs text-ink-muted">{{ t('collage.watermarkMode') }}</div>
          <div class="grid grid-cols-2 gap-1">
            <button
              type="button"
              class="rounded border px-1 py-1.5 text-xs"
              :class="
                (style.watermark.mode ?? 'tile') === 'tile'
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
        <div v-if="(style.watermark.mode ?? 'tile') === 'tile'">
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
                  (style.watermark.position ?? 'center') === slot.id
                    ? 'border-brand bg-brand/10 text-brand-fg'
                    : 'border-border'
                "
                :title="t(`collage.${slot.key}`)"
                :aria-label="t(`collage.${slot.key}`)"
                :aria-pressed="(style.watermark.position ?? 'center') === slot.id"
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

      <PanelSection :title="t('collage.export')">
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
          @click="onDownload"
        >
          {{ t('collage.download') }}
        </button>
        <button
          type="button"
          class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink-muted hover:bg-brand/10 hover:text-brand-fg disabled:opacity-50"
          :disabled="busy || !collage.layout"
          @click="onCopy"
        >
          {{ t('collage.copyClipboard') }}
        </button>
      </PanelSection>
    </div>
  </section>
</template>
