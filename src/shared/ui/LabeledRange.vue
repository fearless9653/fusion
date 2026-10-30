<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    modelValue: number
    min: number
    max: number
    step?: number
    /** Appended after the numeric display (e.g. px, °). */
    suffix?: string
  }>(),
  { step: 1, suffix: '' },
)

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()
</script>

<template>
  <label class="block text-xs text-ink-muted">
    {{ label }}: {{ modelValue }}{{ suffix }}
    <input
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :value="modelValue"
      class="mt-1 w-full"
      @input="emit('update:modelValue', Number(($event.target as HTMLInputElement).value))"
    />
  </label>
</template>
