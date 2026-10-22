<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import LayoutEditorSettings from '@/features/layout-editor/components/LayoutEditorSettings.vue'
import LayoutGridEditor from '@/features/layout-editor/components/LayoutGridEditor.vue'
import LayoutJsonPanel from '@/features/layout-editor/components/LayoutJsonPanel.vue'
import { useLayoutEditorStore } from '@/features/layout-editor'
import {
  EDITOR_SIDEBAR_LEFT_KEY,
  EDITOR_SIDEBAR_RIGHT_KEY,
  readSidebarCollapsed,
  writeSidebarCollapsed,
} from '@/features/canvas/sidebarCollapse'
import { SidebarShell } from '@/shared/ui'

const { t } = useI18n()
const editor = useLayoutEditorStore()

const leftCollapsed = ref(false)
const rightCollapsed = ref(false)

function toggleLeft(): void {
  leftCollapsed.value = !leftCollapsed.value
}

function toggleRight(): void {
  rightCollapsed.value = !rightCollapsed.value
}

watch(leftCollapsed, (v) => writeSidebarCollapsed(EDITOR_SIDEBAR_LEFT_KEY, v))
watch(rightCollapsed, (v) => writeSidebarCollapsed(EDITOR_SIDEBAR_RIGHT_KEY, v))

onMounted(() => {
  leftCollapsed.value = readSidebarCollapsed(EDITOR_SIDEBAR_LEFT_KEY)
  rightCollapsed.value = readSidebarCollapsed(EDITOR_SIDEBAR_RIGHT_KEY)
  editor.loadDraftOrDefault()
})
</script>

<template>
  <div
    class="relative flex h-full min-h-0 w-full gap-0 overflow-hidden rounded-xl border border-border bg-surface-muted shadow-sm"
  >
    <SidebarShell
      side="left"
      :collapsed="leftCollapsed"
      :expand-label="t('collage.expandLeft')"
      :collapse-label="t('collage.collapseLeft')"
      @toggle="toggleLeft"
    >
      <div class="flex h-full min-h-0 flex-col overflow-hidden px-3">
        <LayoutEditorSettings />
      </div>
    </SidebarShell>

    <section class="relative z-0 min-h-0 min-w-0 flex-1 overflow-y-auto bg-border-muted/80 p-3">
      <LayoutGridEditor />
    </section>

    <SidebarShell
      side="right"
      :collapsed="rightCollapsed"
      :expand-label="t('collage.expandRight')"
      :collapse-label="t('collage.collapseRight')"
      @toggle="toggleRight"
    >
      <div class="flex h-full min-h-0 flex-col overflow-hidden p-3">
        <LayoutJsonPanel />
      </div>
    </SidebarShell>
  </div>
</template>
