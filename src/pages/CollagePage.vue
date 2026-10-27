<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getTemplate } from '@/entities/layout'
import { useCollageStore } from '@/features/canvas'
import LayoutPicker from '@/features/canvas/components/LayoutPicker.vue'
import CollageCanvas from '@/features/canvas/components/CollageCanvas.vue'
import StylePanel from '@/features/canvas/components/StylePanel.vue'
import {
  SIDEBAR_LEFT_KEY,
  SIDEBAR_RIGHT_KEY,
  readSidebarCollapsed,
  writeSidebarCollapsed,
} from '@/features/canvas/sidebarCollapse'
import { useStageSidebarInsets } from '@/features/canvas/composables/useStageSidebarInsets'
import { fillEmptyCells, imageFilesFromList, isFileDrag, useImageRegistry } from '@/features/images'
import { clearCustomLayoutHandoff, readCustomLayoutHandoff } from '@/features/layout-editor'
import { SidebarShell } from '@/shared/ui'

const { t } = useI18n()
const collage = useCollageStore()
const registry = useImageRegistry()

/** Nested dragenter/leave depth so overlay does not flicker. */
const dragDepth = ref(0)
const pageDropActive = ref(false)

const leftCollapsed = ref(false)
const rightCollapsed = ref(false)
const { stageInsetStyle } = useStageSidebarInsets(leftCollapsed, rightCollapsed)

function clearPageDropUi(): void {
  dragDepth.value = 0
  pageDropActive.value = false
}

function toggleLeft(): void {
  leftCollapsed.value = !leftCollapsed.value
}

function toggleRight(): void {
  rightCollapsed.value = !rightCollapsed.value
}

watch(leftCollapsed, (v) => writeSidebarCollapsed(SIDEBAR_LEFT_KEY, v))
watch(rightCollapsed, (v) => writeSidebarCollapsed(SIDEBAR_RIGHT_KEY, v))

onMounted(() => {
  leftCollapsed.value = readSidebarCollapsed(SIDEBAR_LEFT_KEY)
  rightCollapsed.value = readSidebarCollapsed(SIDEBAR_RIGHT_KEY)

  // Clear overlay even when a child (cell) handles drop and stops propagation.
  window.addEventListener('drop', clearPageDropUi, true)
  window.addEventListener('dragend', clearPageDropUi)

  const handoff = readCustomLayoutHandoff()
  if (handoff) {
    try {
      collage.applyCustomLayout(handoff)
      clearCustomLayoutHandoff()
      return
    } catch {
      // Invalid / incomplete handoff — fall through to default template.
      clearCustomLayoutHandoff()
    }
  }
  if (!collage.layout) {
    // Product default: five-panel pinwheel (五图旋风 / favicon). Always in CORE_TEMPLATES.
    const defaultTpl = getTemplate('tpl_5_center')
    if (defaultTpl) collage.setLayout(defaultTpl)
  }
})

onUnmounted(() => {
  window.removeEventListener('drop', clearPageDropUi, true)
  window.removeEventListener('dragend', clearPageDropUi)
})

function onPageDragEnter(event: DragEvent): void {
  if (!isFileDrag(event.dataTransfer)) return
  event.preventDefault()
  dragDepth.value += 1
  pageDropActive.value = true
}

function onPageDragOver(event: DragEvent): void {
  if (!isFileDrag(event.dataTransfer)) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
}

function onPageDragLeave(event: DragEvent): void {
  if (!isFileDrag(event.dataTransfer) && dragDepth.value === 0) return
  event.preventDefault()
  dragDepth.value = Math.max(0, dragDepth.value - 1)
  if (dragDepth.value === 0) pageDropActive.value = false
}

async function onPageDrop(event: DragEvent): Promise<void> {
  event.preventDefault()
  dragDepth.value = 0
  pageDropActive.value = false
  const files = imageFilesFromList(event.dataTransfer?.files)
  if (!files.length || !collage.layout) return
  const added = await registry.addFiles(files)
  fillEmptyCells(
    collage.cellImages,
    added.map((img) => img.id),
    (i, id) => collage.assignImage(i, id),
  )
}
</script>

<template>
  <div
    class="relative h-full min-h-0 w-full overflow-hidden rounded-xl border border-border bg-surface-muted shadow-sm"
    @dragenter="onPageDragEnter"
    @dragover="onPageDragOver"
    @dragleave="onPageDragLeave"
    @drop="onPageDrop"
  >
    <!-- Full-bleed stage underlay; ≥1024 insets track expanded sidebars. -->
    <section
      class="absolute inset-0 z-0 flex min-h-0 min-w-0 flex-col overflow-hidden bg-border-muted/80 py-8 transition-[padding] duration-200 ease-out"
      :style="stageInsetStyle"
    >
      <CollageCanvas />
    </section>

    <SidebarShell
      side="left"
      :collapsed="leftCollapsed"
      :expand-label="t('collage.expandLeft')"
      :collapse-label="t('collage.collapseLeft')"
      @toggle="toggleLeft"
    >
      <LayoutPicker />
    </SidebarShell>

    <SidebarShell
      side="right"
      :collapsed="rightCollapsed"
      :expand-label="t('collage.expandRight')"
      :collapse-label="t('collage.collapseRight')"
      @toggle="toggleRight"
    >
      <StylePanel />
    </SidebarShell>

    <div
      v-if="pageDropActive"
      class="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-brand/20 backdrop-blur-[1px]"
      aria-hidden="true"
    >
      <div
        class="rounded-xl border-2 border-dashed border-brand bg-surface/90 px-8 py-6 text-center shadow-lg"
      >
        <p class="text-base font-semibold text-brand-fg">{{ t('collage.pageDropTitle') }}</p>
        <p class="mt-1 text-sm text-ink-muted">{{ t('collage.pageDropHint') }}</p>
      </div>
    </div>
  </div>
</template>
