<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { House } from '@lucide/vue'
import { RouterLink, useRouter } from 'vue-router'
import { MAX_GRID, MIN_GRID, useLayoutEditorStore } from '../layoutEditorStore'

const { t } = useI18n()
const editor = useLayoutEditorStore()
const router = useRouter()

const draftRows = ref(editor.rows)
const draftCols = ref(editor.cols)
const draftName = ref(editor.name)

watch(
  () => [editor.rows, editor.cols, editor.name] as const,
  ([r, c, n]) => {
    draftRows.value = r
    draftCols.value = c
    draftName.value = n
  },
)

function applyGrid(): void {
  const r = Math.min(MAX_GRID, Math.max(MIN_GRID, Number(draftRows.value) || MIN_GRID))
  const c = Math.min(MAX_GRID, Math.max(MIN_GRID, Number(draftCols.value) || MIN_GRID))
  draftRows.value = r
  draftCols.value = c
  editor.initGrid(r, c)
  draftName.value = editor.name
}

function applyName(): void {
  editor.setName(draftName.value)
  draftName.value = editor.name
}

function onUseLayout(): void {
  const layout = editor.useThisLayout()
  if (!layout) return
  void router.push({ name: 'collage' })
}
</script>

<template>
  <section class="flex h-full min-h-0 flex-col">
    <header
      class="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-surface px-0 py-2.5"
    >
      <h2 class="text-sm font-semibold text-ink">{{ t('customLayout.settings') }}</h2>
      <RouterLink
        to="/"
        class="rounded border border-border bg-surface p-1.5 text-ink-muted hover:bg-brand/10 hover:text-brand-fg"
        :title="t('customLayout.backToCollage')"
        :aria-label="t('customLayout.backToCollage')"
      >
        <House class="h-4 w-4" aria-hidden="true" />
      </RouterLink>
    </header>
    <div class="panel-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pt-3">
      <p class="text-xs text-ink-muted">{{ t('customLayout.settingsHint') }}</p>

      <label class="flex flex-col gap-1 text-xs text-ink-muted">
        <span>{{ t('customLayout.name') }}</span>
        <input
          v-model="draftName"
          type="text"
          class="rounded-md border border-border px-2 py-1.5 text-sm text-ink"
          @change="applyName"
          @keydown.enter.prevent="applyName"
        />
      </label>

      <div class="grid grid-cols-2 gap-2">
        <label class="flex flex-col gap-1 text-xs text-ink-muted">
          <span>{{ t('customLayout.rows') }}</span>
          <input
            v-model.number="draftRows"
            type="number"
            :min="MIN_GRID"
            :max="MAX_GRID"
            class="rounded-md border border-border px-2 py-1.5 text-sm text-ink"
          />
        </label>
        <label class="flex flex-col gap-1 text-xs text-ink-muted">
          <span>{{ t('customLayout.cols') }}</span>
          <input
            v-model.number="draftCols"
            type="number"
            :min="MIN_GRID"
            :max="MAX_GRID"
            class="rounded-md border border-border px-2 py-1.5 text-sm text-ink"
          />
        </label>
      </div>
      <button
        type="button"
        class="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-muted"
        @click="applyGrid"
      >
        {{ t('customLayout.initGrid') }}
      </button>

      <div class="flex flex-col gap-2 border-t border-border-muted pt-3">
        <button
          type="button"
          class="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-muted disabled:opacity-40"
          :disabled="editor.selectedIndex === null"
          @click="editor.deleteSelected()"
        >
          {{ t('customLayout.deleteSelected') }}
        </button>
        <button
          type="button"
          class="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-muted"
          @click="editor.autoFill()"
        >
          {{ t('customLayout.autoFill') }}
        </button>
        <button
          type="button"
          class="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-muted"
          @click="editor.resetLayout()"
        >
          {{ t('customLayout.reset') }}
        </button>
      </div>

      <div class="mt-auto flex flex-col gap-2 border-t border-border-muted pt-3">
        <p class="text-xs text-ink-muted">
          <span :class="editor.fullCoverage ? 'font-medium text-brand-fg' : 'text-warning-fg'">
            {{
              editor.fullCoverage
                ? t('customLayout.coverageOk')
                : t('customLayout.coverageNeed', {
                    covered: editor.coverageUnits,
                    total: editor.totalUnits,
                  })
            }}
          </span>
        </p>
        <button
          type="button"
          class="rounded-md bg-brand-solid px-3 py-2 text-sm font-medium text-white hover:bg-brand-solid-hover disabled:cursor-not-allowed disabled:bg-border"
          :disabled="!editor.canUseLayout"
          @click="onUseLayout"
        >
          {{ t('customLayout.useLayout') }}
        </button>
      </div>
    </div>
  </section>
</template>
