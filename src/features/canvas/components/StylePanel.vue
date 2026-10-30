<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RotateCcw } from '@lucide/vue'
import { useCollageStore } from '@/features/canvas'
import AspectSection from '@/features/canvas/components/style-panel/AspectSection.vue'
import StyleControlsSection from '@/features/canvas/components/style-panel/StyleControlsSection.vue'
import WatermarkSection from '@/features/canvas/components/style-panel/WatermarkSection.vue'
import ExportFooter from '@/features/canvas/components/style-panel/ExportFooter.vue'
import {
  canvasToBlob,
  copyBlobToClipboard,
  downloadBlob,
  exportFilename,
  jpegQualityFor,
  buildRenderImages,
  renderCollage,
} from '@/features/export'
import { useImageRegistry } from '@/features/images'
import { IconToolbarButton, showToast } from '@/shared/ui'

const { t } = useI18n()
const collage = useCollageStore()
const registry = useImageRegistry()
const busy = ref(false)

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
        <IconToolbarButton :label="t('collage.resetStyles')" @click="collage.resetStyles()">
          <RotateCcw class="h-4 w-4" aria-hidden="true" />
        </IconToolbarButton>
      </div>
    </header>

    <div
      class="panel-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden p-3"
    >
      <AspectSection />
      <StyleControlsSection />
      <WatermarkSection />
    </div>

    <ExportFooter :busy="busy" @download="onDownload" @copy="onCopy" />
  </section>
</template>
