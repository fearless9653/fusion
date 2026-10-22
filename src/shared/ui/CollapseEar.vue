<script setup lang="ts">
import { computed } from 'vue'
import { ChevronLeft, ChevronRight } from '@lucide/vue'

const props = defineProps<{
  side: 'left' | 'right'
  collapsed: boolean
  expandLabel: string
  collapseLabel: string
}>()

defineEmits<{ toggle: [] }>()

const label = computed(() => (props.collapsed ? props.expandLabel : props.collapseLabel))

const earClass = computed(() => {
  if (props.side === 'left') {
    return ['right-0', props.collapsed ? 'translate-x-full' : 'translate-x-1/2']
  }
  return ['left-0', props.collapsed ? '-translate-x-full' : '-translate-x-1/2']
})
</script>

<template>
  <button
    type="button"
    class="pointer-events-auto absolute top-1/2 z-30 flex h-16 w-8 -translate-y-1/2 items-center justify-center rounded-md border border-border bg-surface text-ink-muted shadow-sm hover:bg-surface-muted hover:text-brand"
    :class="earClass"
    :title="label"
    :aria-label="label"
    :aria-expanded="!collapsed"
    @click="$emit('toggle')"
  >
    <template v-if="side === 'left'">
      <ChevronRight v-if="collapsed" class="h-4 w-4" aria-hidden="true" />
      <ChevronLeft v-else class="h-4 w-4" aria-hidden="true" />
    </template>
    <template v-else>
      <ChevronLeft v-if="collapsed" class="h-4 w-4" aria-hidden="true" />
      <ChevronRight v-else class="h-4 w-4" aria-hidden="true" />
    </template>
  </button>
</template>
