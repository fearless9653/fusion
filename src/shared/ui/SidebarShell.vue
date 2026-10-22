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
  const border =
    props.side === 'left'
      ? props.collapsed
        ? 'w-0 border-0'
        : `${props.widthClass} border-r border-border`
      : props.collapsed
        ? 'w-0 border-0'
        : `${props.widthClass} border-l border-border`
  return border
})
</script>

<template>
  <aside
    class="relative z-20 flex min-h-0 shrink-0 flex-col overflow-visible bg-surface transition-[width] duration-200 ease-out"
    :class="asideClass"
  >
    <div
      v-show="!collapsed"
      class="flex h-full min-h-0 flex-col overflow-hidden"
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
