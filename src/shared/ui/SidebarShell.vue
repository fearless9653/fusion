<script setup lang="ts">
import { computed } from 'vue'
import CollapseEar from './CollapseEar.vue'

const props = withDefaults(
  defineProps<{
    side: 'left' | 'right'
    collapsed: boolean
    expandLabel: string
    collapseLabel: string
    /** Expanded width Tailwind class (default w-64). */
    widthClass?: string
  }>(),
  { widthClass: 'w-64' },
)

defineEmits<{ toggle: [] }>()

const asideClass = computed(() => {
  const sidePin = props.side === 'left' ? 'left-0' : 'right-0'
  const border =
    props.side === 'left'
      ? props.collapsed
        ? 'w-0 border-0'
        : `${props.widthClass} border-r border-border`
      : props.collapsed
        ? 'w-0 border-0'
        : `${props.widthClass} border-l border-border`
  return [sidePin, border]
})
</script>

<template>
  <!-- Absolute overlay: sits above the stage; CollapseEar stays pointer-events-auto. -->
  <aside
    class="pointer-events-none absolute inset-y-0 z-20 flex min-h-0 flex-col overflow-visible bg-surface transition-[width] duration-200 ease-out"
    :class="asideClass"
  >
    <div
      v-show="!collapsed"
      class="pointer-events-auto flex h-full min-h-0 flex-col overflow-hidden"
      :class="widthClass"
    >
      <slot />
    </div>
    <CollapseEar
      :side="side"
      :collapsed="collapsed"
      :expand-label="expandLabel"
      :collapse-label="collapseLabel"
      @toggle="$emit('toggle')"
    />
  </aside>
</template>
