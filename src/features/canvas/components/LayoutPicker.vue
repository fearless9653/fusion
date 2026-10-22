<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  GripVertical,
  LayoutTemplate,
  Star,
} from '@lucide/vue'
import { RouterLink } from 'vue-router'
import {
  ensureTemplateCatalog,
  getTemplate,
  listTemplates,
  type LayoutDefinition,
} from '@/entities/layout'
import { useCollageStore } from '@/features/canvas'
import {
  LAYOUT_GROUPS_EXPANDED_KEY,
  readExpandedGroupCounts,
  readFavoriteIds,
  writeExpandedGroupCounts,
  writeFavoriteIds,
} from '@/features/canvas/layoutPickerStorage'
import { getCustomLayout } from '@/features/canvas/customLayoutRegistry'

const { t } = useI18n()
const collage = useCollageStore()
const templates = ref<LayoutDefinition[]>(listTemplates())
const catalogLoading = ref(true)

onMounted(() => {
  void ensureTemplateCatalog()
    .then(() => {
      templates.value = listTemplates()
    })
    .finally(() => {
      catalogLoading.value = false
    })
})

const activeId = computed(() => collage.layout?.id ?? null)

const groups = computed(() => {
  const map = new Map<number, LayoutDefinition[]>()
  for (const tpl of templates.value) {
    const list = map.get(tpl.imageCount) ?? []
    list.push(tpl)
    map.set(tpl.imageCount, list)
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([count, items]) => ({ count, items }))
})

const allCounts = computed(() => groups.value.map((g) => g.count))

const expandedCounts = ref<number[]>(readExpandedGroupCounts(allCounts.value))
const favoriteIds = ref<string[]>(readFavoriteIds())

watch(allCounts, (counts) => {
  const raw = localStorage.getItem(LAYOUT_GROUPS_EXPANDED_KEY)
  if (raw === null) {
    expandedCounts.value = [...counts]
    return
  }
  const allowed = new Set(counts)
  expandedCounts.value = expandedCounts.value.filter((n) => allowed.has(n))
})

watch(
  expandedCounts,
  (v) => {
    writeExpandedGroupCounts(v)
  },
  { deep: true },
)

watch(
  favoriteIds,
  (v) => {
    writeFavoriteIds(v)
  },
  { deep: true },
)

const favoriteTemplates = computed(() => {
  const out: LayoutDefinition[] = []
  for (const id of favoriteIds.value) {
    const tpl =
      templates.value.find((item) => item.id === id) ?? getTemplate(id) ?? getCustomLayout(id)
    if (tpl) out.push(tpl)
  }
  return out
})

function isExpanded(count: number): boolean {
  return expandedCounts.value.includes(count)
}

function toggleGroup(count: number): void {
  if (isExpanded(count)) {
    expandedCounts.value = expandedCounts.value.filter((n) => n !== count)
  } else {
    expandedCounts.value = [...expandedCounts.value, count].sort((a, b) => a - b)
  }
}

function expandAllGroups(): void {
  expandedCounts.value = [...allCounts.value]
}

function collapseAllGroups(): void {
  expandedCounts.value = []
}

function isFavorite(id: string): boolean {
  return favoriteIds.value.includes(id)
}

function toggleFavorite(id: string, event?: Event): void {
  event?.stopPropagation()
  event?.preventDefault()
  if (isFavorite(id)) {
    favoriteIds.value = favoriteIds.value.filter((x) => x !== id)
  } else {
    favoriteIds.value = [...favoriteIds.value, id]
  }
}

function pick(tpl: LayoutDefinition): void {
  collage.setLayout(tpl)
}

function cellStyle(cell: LayoutDefinition['cells'][number]) {
  return {
    gridRow: `${cell.row + 1} / span ${cell.rowSpan}`,
    gridColumn: `${cell.col + 1} / span ${cell.colSpan}`,
  }
}

const dragFromIndex = ref<number | null>(null)

function onFavoriteDragStart(index: number, event: DragEvent): void {
  dragFromIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
  }
}

function onFavoriteDragOver(event: DragEvent): void {
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
}

function onFavoriteDrop(toIndex: number, event: DragEvent): void {
  event.preventDefault()
  const from = dragFromIndex.value
  dragFromIndex.value = null
  if (from === null || from === toIndex) return
  const next = [...favoriteIds.value]
  const [item] = next.splice(from, 1)
  if (!item) return
  next.splice(toIndex, 0, item)
  favoriteIds.value = next
}

function onFavoriteDragEnd(): void {
  dragFromIndex.value = null
}
</script>

<template>
  <section class="flex h-full min-h-0 flex-col">
    <header
      class="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-surface px-3 py-2.5"
    >
      <h2 class="text-sm font-semibold text-ink">{{ t('collage.layouts') }}</h2>
      <div class="flex gap-1">
        <RouterLink
          to="/custom-layout"
          class="rounded border border-border bg-surface p-1.5 text-ink-muted hover:bg-brand/10 hover:text-brand-fg"
          :title="t('nav.customLayout')"
          :aria-label="t('nav.customLayout')"
        >
          <LayoutTemplate class="h-4 w-4" aria-hidden="true" />
        </RouterLink>
        <button
          type="button"
          class="rounded border border-border bg-surface p-1.5 text-ink-muted hover:bg-brand/10 hover:text-brand-fg"
          :title="t('collage.expandAllGroups')"
          :aria-label="t('collage.expandAllGroups')"
          @click="expandAllGroups"
        >
          <ChevronsUpDown class="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="rounded border border-border bg-surface p-1.5 text-ink-muted hover:bg-brand/10 hover:text-brand-fg"
          :title="t('collage.collapseAllGroups')"
          :aria-label="t('collage.collapseAllGroups')"
          @click="collapseAllGroups"
        >
          <ChevronsDownUp class="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </header>

    <div class="panel-scroll min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-3">
      <div v-if="favoriteTemplates.length" class="flex flex-col gap-1.5">
        <div class="text-[11px] font-medium tracking-wide text-ink-muted">
          {{ t('collage.favorites') }}
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div
            v-for="(tpl, favIndex) in favoriteTemplates"
            :key="'fav-' + tpl.id"
            class="relative"
            draggable="true"
            @dragstart="onFavoriteDragStart(favIndex, $event)"
            @dragover="onFavoriteDragOver"
            @drop="onFavoriteDrop(favIndex, $event)"
            @dragend="onFavoriteDragEnd"
          >
            <button
              type="button"
              class="w-full rounded-lg border p-2 transition hover:border-brand/50 hover:bg-brand/10"
              :class="
                activeId === tpl.id
                  ? 'border-brand bg-brand/10 ring-1 ring-brand'
                  : 'border-border bg-surface'
              "
              :aria-label="tpl.id"
              @click="pick(tpl)"
            >
              <div
                class="aspect-square w-full gap-0.5 rounded-md bg-border-muted p-1"
                :style="{
                  display: 'grid',
                  gridTemplateRows: `repeat(${tpl.grid.rows}, 1fr)`,
                  gridTemplateColumns: `repeat(${tpl.grid.cols}, 1fr)`,
                }"
              >
                <div
                  v-for="(cell, i) in tpl.cells"
                  :key="i"
                  class="rounded-sm bg-brand/80"
                  :style="cellStyle(cell)"
                />
              </div>
            </button>
            <span
              class="pointer-events-none absolute top-1 left-1 rounded bg-surface/90 p-0.5 text-ink-muted shadow-sm"
              aria-hidden="true"
            >
              <GripVertical class="h-3.5 w-3.5" />
            </span>
            <button
              type="button"
              class="absolute top-1 right-1 rounded bg-surface/90 p-0.5 text-brand shadow-sm hover:bg-surface"
              :title="t('collage.unfavoriteLayout')"
              :aria-label="t('collage.unfavoriteLayout')"
              @click="toggleFavorite(tpl.id, $event)"
            >
              <Star class="h-3.5 w-3.5 fill-brand text-brand" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <div v-for="group in groups" :key="group.count" class="flex flex-col gap-1.5">
        <button
          type="button"
          class="flex w-full items-center gap-1 rounded px-0.5 py-0.5 text-left text-[11px] font-medium tracking-wide text-ink-muted hover:bg-surface-muted hover:text-ink"
          :aria-expanded="isExpanded(group.count)"
          @click="toggleGroup(group.count)"
        >
          <ChevronDown
            v-if="isExpanded(group.count)"
            class="h-3.5 w-3.5 shrink-0"
            aria-hidden="true"
          />
          <ChevronRight v-else class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{{ t('collage.layoutGroup', { n: group.count }) }}</span>
        </button>
        <div v-show="isExpanded(group.count)" class="grid grid-cols-2 gap-2">
          <div v-for="tpl in group.items" :key="tpl.id" class="relative">
            <button
              type="button"
              class="w-full rounded-lg border p-2 transition hover:border-brand/50 hover:bg-brand/10"
              :class="
                activeId === tpl.id
                  ? 'border-brand bg-brand/10 ring-1 ring-brand'
                  : 'border-border bg-surface'
              "
              :aria-label="tpl.id"
              @click="pick(tpl)"
            >
              <div
                class="aspect-square w-full gap-0.5 rounded-md bg-border-muted p-1"
                :style="{
                  display: 'grid',
                  gridTemplateRows: `repeat(${tpl.grid.rows}, 1fr)`,
                  gridTemplateColumns: `repeat(${tpl.grid.cols}, 1fr)`,
                }"
              >
                <div
                  v-for="(cell, i) in tpl.cells"
                  :key="i"
                  class="rounded-sm bg-brand/80"
                  :style="cellStyle(cell)"
                />
              </div>
            </button>
            <button
              type="button"
              class="absolute top-1 right-1 rounded bg-surface/90 p-0.5 shadow-sm hover:bg-surface"
              :class="isFavorite(tpl.id) ? 'text-brand' : 'text-ink-muted hover:text-brand'"
              :title="
                isFavorite(tpl.id) ? t('collage.unfavoriteLayout') : t('collage.favoriteLayout')
              "
              :aria-label="
                isFavorite(tpl.id) ? t('collage.unfavoriteLayout') : t('collage.favoriteLayout')
              "
              :aria-pressed="isFavorite(tpl.id)"
              @click="toggleFavorite(tpl.id, $event)"
            >
              <Star
                class="h-3.5 w-3.5"
                :class="isFavorite(tpl.id) ? 'fill-brand text-brand' : ''"
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
