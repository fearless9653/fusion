<script setup lang="ts">
import { computed } from 'vue'
import { dismissToast, useToastState } from './toast'

const { toast } = useToastState()

const kindClass = computed(() => {
  const k = toast.value?.kind
  if (k === 'success') return 'border-brand/30 bg-brand/10 text-brand-fg'
  if (k === 'error') return 'border-danger bg-danger-muted text-danger-fg'
  return 'border-border bg-surface text-ink'
})
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 top-4 z-[100] flex justify-center px-3"
    aria-live="polite"
    aria-relevant="additions"
  >
    <transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="-translate-y-2 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="-translate-y-1 opacity-0"
    >
      <div
        v-if="toast"
        role="status"
        class="pointer-events-auto max-w-sm rounded-lg border px-3 py-2 text-sm shadow-lg"
        :class="kindClass"
      >
        <div class="flex items-start gap-2">
          <p class="min-w-0 flex-1 leading-snug">{{ toast.message }}</p>
          <button
            type="button"
            class="shrink-0 rounded px-1 text-xs opacity-60 hover:opacity-100"
            :aria-label="'Dismiss'"
            @click="dismissToast()"
          >
            ×
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>
