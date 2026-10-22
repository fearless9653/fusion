<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, useSlots } from 'vue'
import { Check, ChevronDown } from '@lucide/vue'

export type MenuSelectOption = { value: string; label: string }

const props = withDefaults(
  defineProps<{
    modelValue: string
    options: MenuSelectOption[]
    /** Accessible name for the trigger (title + aria-label). */
    label: string
    /** Menu horizontal alignment relative to the trigger. */
    align?: 'start' | 'end'
    /** Extra classes on the trigger (e.g. fixed width). */
    triggerClass?: string
  }>(),
  { align: 'end', triggerClass: '' },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const slots = useSlots()
const open = ref(false)
const rootEl = ref<HTMLElement | null>(null)
const listEl = ref<HTMLElement | null>(null)
const activeIndex = ref(0)

const selectedLabel = computed(() => {
  const hit = props.options.find((o) => o.value === props.modelValue)
  return hit?.label ?? props.modelValue
})

const hasIcon = computed(() => Boolean(slots.icon))

function syncActiveFromValue(): void {
  const i = props.options.findIndex((o) => o.value === props.modelValue)
  activeIndex.value = i >= 0 ? i : 0
}

function close(): void {
  open.value = false
}

function openMenu(): void {
  syncActiveFromValue()
  open.value = true
  void nextTick(() => {
    listEl.value?.focus()
  })
}

function toggle(): void {
  if (open.value) close()
  else openMenu()
}

function select(value: string): void {
  emit('update:modelValue', value)
  close()
}

function onDocPointerDown(event: PointerEvent): void {
  if (!open.value || !rootEl.value) return
  const target = event.target as Node | null
  if (target && !rootEl.value.contains(target)) close()
}

function onTriggerKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    openMenu()
  }
}

function onListKeydown(event: KeyboardEvent): void {
  const n = props.options.length
  if (!n) return
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % n
    return
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value = (activeIndex.value - 1 + n) % n
    return
  }
  if (event.key === 'Home') {
    event.preventDefault()
    activeIndex.value = 0
    return
  }
  if (event.key === 'End') {
    event.preventDefault()
    activeIndex.value = n - 1
    return
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    const opt = props.options[activeIndex.value]
    if (opt) select(opt.value)
  }
}

watch(
  () => props.modelValue,
  () => {
    if (!open.value) syncActiveFromValue()
  },
)

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown, true)
})
</script>

<template>
  <div ref="rootEl" class="relative" :class="open ? 'z-[200]' : ''">
    <button
      type="button"
      class="inline-flex h-8 min-h-8 items-center gap-1.5 rounded-full bg-border-muted px-2.5 text-xs font-medium leading-none text-ink-muted hover:bg-border hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      :class="[triggerClass, open ? 'bg-border text-ink' : '']"
      :title="label"
      :aria-label="label"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="toggle"
      @keydown="onTriggerKeydown"
    >
      <span v-if="hasIcon" class="inline-flex shrink-0 text-ink-muted" aria-hidden="true">
        <slot name="icon" />
      </span>
      <span class="min-w-0 flex-1 truncate text-left">{{ selectedLabel }}</span>
      <ChevronDown
        class="h-3.5 w-3.5 shrink-0 opacity-70 transition-transform"
        :class="open ? 'rotate-180' : ''"
        aria-hidden="true"
      />
    </button>

    <ul
      v-if="open"
      ref="listEl"
      role="listbox"
      tabindex="-1"
      class="absolute z-[200] mt-1 min-w-full overflow-hidden rounded-lg border border-border bg-surface py-1 text-xs shadow-lg focus:outline-none"
      :class="align === 'end' ? 'right-0' : 'left-0'"
      :aria-label="label"
      @keydown="onListKeydown"
    >
      <li
        v-for="(opt, index) in options"
        :key="opt.value"
        role="option"
        class="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-ink-muted hover:bg-brand/10 hover:text-brand-fg"
        :class="[
          opt.value === modelValue ? 'bg-brand/10 font-medium text-brand-fg' : '',
          index === activeIndex ? 'bg-border-muted text-ink' : '',
        ]"
        :aria-selected="opt.value === modelValue"
        @pointerdown.prevent="select(opt.value)"
        @mouseenter="activeIndex = index"
      >
        <Check
          class="h-3.5 w-3.5 shrink-0"
          :class="opt.value === modelValue ? 'opacity-100' : 'opacity-0'"
          aria-hidden="true"
        />
        <span>{{ opt.label }}</span>
      </li>
    </ul>
  </div>
</template>
