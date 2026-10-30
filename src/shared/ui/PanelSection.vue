<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    /** Initial open state only (uncontrolled after mount). */
    initiallyOpen?: boolean
  }>(),
  { initiallyOpen: true },
)

const emit = defineEmits<{
  toggle: [open: boolean]
}>()

function onToggle(event: Event): void {
  const el = event.currentTarget as HTMLDetailsElement
  emit('toggle', el.open)
}
</script>

<template>
  <details
    class="rounded-lg border border-border bg-surface p-3"
    v-bind="initiallyOpen ? { open: true } : {}"
    @toggle="onToggle"
  >
    <summary class="cursor-pointer font-medium text-ink">{{ title }}</summary>
    <div class="mt-3 space-y-3">
      <slot />
    </div>
  </details>
</template>
