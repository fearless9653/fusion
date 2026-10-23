<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, Copy } from '@lucide/vue'
import { showToast } from '@/shared/ui'
import { useLayoutEditorStore } from '../layoutEditorStore'

const { t } = useI18n()
const editor = useLayoutEditorStore()
const fileInput = ref<HTMLInputElement | null>(null)
/** Editable JSON buffer — kept in sync with live layout unless the user is editing. */
const importText = ref(editor.jsonPreview)
const jsonDirty = ref(false)
const copiedFlash = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => editor.jsonPreview,
  (preview) => {
    if (!jsonDirty.value) importText.value = preview
  },
)

function exportFile(): void {
  const blob = new Blob([editor.jsonPreview], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = (editor.id || 'layout') + '.json'
  a.click()
  URL.revokeObjectURL(url)
}

function onPickFile(): void {
  fileInput.value?.click()
}

async function onFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const text = await file.text()
  importText.value = text
  jsonDirty.value = false
  editor.importJson(text)
}

function onTextInput(): void {
  jsonDirty.value = true
}

function syncFromPreview(): void {
  importText.value = editor.jsonPreview
  jsonDirty.value = false
}

function applyPaste(): void {
  const ok = editor.importJson(importText.value)
  if (ok) {
    importText.value = editor.jsonPreview
    jsonDirty.value = false
  }
}

async function copyJson(): Promise<void> {
  const text = importText.value
  try {
    await navigator.clipboard.writeText(text)
    copiedFlash.value = true
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => {
      copiedFlash.value = false
    }, 1500)
    showToast(t('customLayout.copyJsonDone'), 'success')
  } catch {
    showToast(t('customLayout.copyJsonFailed'), 'error')
  }
}
</script>

<template>
  <section class="flex h-full min-h-0 flex-col gap-3">
    <div class="flex items-center justify-between gap-2">
      <h2 class="text-sm font-semibold text-ink">{{ t('customLayout.json') }}</h2>
      <div class="flex gap-1">
        <button
          type="button"
          class="rounded-md border border-border bg-surface px-2 py-1 text-xs text-ink-muted hover:bg-brand/10 hover:text-brand-fg"
          @click="exportFile"
        >
          {{ t('customLayout.exportJson') }}
        </button>
        <button
          type="button"
          class="rounded-md border border-border bg-surface px-2 py-1 text-xs text-ink-muted hover:bg-brand/10 hover:text-brand-fg"
          @click="onPickFile"
        >
          {{ t('customLayout.importJson') }}
        </button>
        <input
          ref="fileInput"
          type="file"
          accept="application/json,.json"
          class="hidden"
          @change="onFileChange"
        />
      </div>
    </div>

    <div class="flex min-h-0 flex-1 flex-col gap-1">
      <span class="text-xs font-medium text-ink-muted">{{ t('customLayout.pasteJson') }}</span>
      <div class="relative min-h-0 flex-1">
        <textarea
          v-model="importText"
          class="panel-scroll h-full min-h-0 w-full resize-none rounded-md border border-border bg-surface p-2 pr-10 font-mono text-[11px] leading-relaxed text-ink placeholder:text-ink-muted"
          :placeholder="t('customLayout.pasteJsonHint')"
          spellcheck="false"
          @input="onTextInput"
        />
        <button
          type="button"
          class="absolute top-2 right-2 z-10 rounded-md border border-border bg-surface/95 p-1.5 text-ink-muted shadow-sm backdrop-blur-sm hover:bg-brand/10 hover:text-brand-fg"
          :title="copiedFlash ? t('customLayout.copyJsonDone') : t('customLayout.copyJson')"
          :aria-label="copiedFlash ? t('customLayout.copyJsonDone') : t('customLayout.copyJson')"
          @click="copyJson"
        >
          <Check v-if="copiedFlash" class="h-3.5 w-3.5 text-brand-fg" aria-hidden="true" />
          <Copy v-else class="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>

    <div class="flex gap-2">
      <button
        type="button"
        class="rounded-md border border-border bg-surface px-2 py-1 text-xs text-ink-muted hover:bg-brand/10 hover:text-brand-fg"
        @click="syncFromPreview"
      >
        {{ t('customLayout.copyPreview') }}
      </button>
      <button
        type="button"
        class="rounded-md border border-brand/30 bg-brand/10 px-2 py-1 text-xs font-medium text-brand-fg hover:bg-brand/15"
        @click="applyPaste"
      >
        {{ t('customLayout.applyJson') }}
      </button>
    </div>

    <ul
      v-if="editor.validationErrors.length"
      class="max-h-28 list-disc overflow-y-auto rounded-md border border-danger bg-danger-muted px-4 py-2 text-xs text-danger-fg"
    >
      <li v-for="(err, i) in editor.validationErrors" :key="i">{{ err }}</li>
    </ul>
  </section>
</template>
