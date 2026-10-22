<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    disabled?: boolean
  }>(),
  { disabled: false },
)
</script>

<template>
  <button
    type="button"
    class="rounded border border-border bg-surface p-1.5 text-ink-muted disabled:opacity-40 hover:bg-brand/10 hover:text-brand-fg"
    :disabled="disabled"
    :title="label"
    :aria-label="label"
  >
    <slot />
  </button>
</template>
