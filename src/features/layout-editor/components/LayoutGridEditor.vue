<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLayoutEditorStore } from '../layoutEditorStore'

const { t } = useI18n()
const editor = useLayoutEditorStore()
const boardRef = ref<HTMLElement | null>(null)

type DragMode = 'move' | 'resize' | null

const dragMode = ref<DragMode>(null)
const dragIndex = ref<number | null>(null)
const dragPointerOffset = ref({ row: 0, col: 0 })

const occupied = computed(() => {
  const map = Array.from({ length: editor.rows }, () =>
    Array.from({ length: editor.cols }, () => false),
  )
  for (const cell of editor.cells) {
    for (let r = cell.row; r < cell.row + cell.rowSpan; r += 1) {
      for (let c = cell.col; c < cell.col + cell.colSpan; c += 1) {
        if (r >= 0 && r < editor.rows && c >= 0 && c < editor.cols) {
          map[r]![c] = true
        }
      }
    }
  }
  return map
})

const units = computed(() => {
  const list: Array<{ row: number; col: number; key: string }> = []
  for (let row = 0; row < editor.rows; row += 1) {
    for (let col = 0; col < editor.cols; col += 1) {
      list.push({ row, col, key: `${row}-${col}` })
    }
  }
  return list
})

function cellPercent(cell: { row: number; col: number; rowSpan: number; colSpan: number }) {
  return {
    left: `${(cell.col / editor.cols) * 100}%`,
    top: `${(cell.row / editor.rows) * 100}%`,
    width: `${(cell.colSpan / editor.cols) * 100}%`,
    height: `${(cell.rowSpan / editor.rows) * 100}%`,
  }
}

function unitPercent(row: number, col: number) {
  return {
    left: `${(col / editor.cols) * 100}%`,
    top: `${(row / editor.rows) * 100}%`,
    width: `${(1 / editor.cols) * 100}%`,
    height: `${(1 / editor.rows) * 100}%`,
  }
}

function pointerToCell(clientX: number, clientY: number): { row: number; col: number } | null {
  const el = boardRef.value
  if (!el) return null
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  const x = (clientX - rect.left) / rect.width
  const y = (clientY - rect.top) / rect.height
  const col = Math.min(editor.cols - 1, Math.max(0, Math.floor(x * editor.cols)))
  const row = Math.min(editor.rows - 1, Math.max(0, Math.floor(y * editor.rows)))
  return { row, col }
}

function onEmptyClick(row: number, col: number): void {
  if (dragMode.value) return
  if (occupied.value[row]?.[col]) return
  editor.addUnitAt(row, col)
}

function onWindowPointerMove(event: PointerEvent): void {
  if (!dragMode.value || dragIndex.value === null) return
  const at = pointerToCell(event.clientX, event.clientY)
  if (!at) return
  const index = dragIndex.value
  const cell = editor.cells[index]
  if (!cell) return

  if (dragMode.value === 'move') {
    const toRow = at.row - dragPointerOffset.value.row
    const toCol = at.col - dragPointerOffset.value.col
    if (toRow === cell.row && toCol === cell.col) return
    editor.moveSelected(toRow, toCol)
    return
  }

  if (dragMode.value === 'resize') {
    const rowSpan = Math.max(1, at.row - cell.row + 1)
    const colSpan = Math.max(1, at.col - cell.col + 1)
    if (rowSpan === cell.rowSpan && colSpan === cell.colSpan) return
    editor.resizeSelected(rowSpan, colSpan)
  }
}

function endDrag(): void {
  if (!dragMode.value) return
  dragMode.value = null
  dragIndex.value = null
  window.removeEventListener('pointermove', onWindowPointerMove)
  window.removeEventListener('pointerup', endDrag)
  window.removeEventListener('pointercancel', endDrag)
}

function beginDrag(): void {
  window.addEventListener('pointermove', onWindowPointerMove)
  window.addEventListener('pointerup', endDrag)
  window.addEventListener('pointercancel', endDrag)
}

function onBlockPointerDown(index: number, event: PointerEvent): void {
  if (event.button !== 0) return
  event.preventDefault()
  event.stopPropagation()
  editor.selectBlock(index)
  const cell = editor.cells[index]
  if (!cell) return
  const at = pointerToCell(event.clientX, event.clientY)
  if (!at) return
  dragMode.value = 'move'
  dragIndex.value = index
  dragPointerOffset.value = { row: at.row - cell.row, col: at.col - cell.col }
  beginDrag()
}

function onResizePointerDown(index: number, event: PointerEvent): void {
  if (event.button !== 0) return
  event.preventDefault()
  event.stopPropagation()
  editor.selectBlock(index)
  dragMode.value = 'resize'
  dragIndex.value = index
  beginDrag()
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Delete' || event.key === 'Backspace') {
    const tag = (event.target as HTMLElement | null)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    if (editor.selectedIndex !== null) {
      event.preventDefault()
      editor.deleteSelected()
    }
  }
  if (event.key === 'Escape') {
    editor.selectBlock(null)
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  endDrag()
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-2">
    <div class="flex items-center justify-between gap-2 text-xs text-ink-muted">
      <span>{{ t('customLayout.canvasHint') }}</span>
      <span>
        {{
          t('customLayout.coverage', { covered: editor.coverageUnits, total: editor.totalUnits })
        }}
      </span>
    </div>
    <div
      class="relative mx-auto aspect-square w-full max-w-[min(100%,640px)] overflow-hidden rounded-lg border border-border bg-surface shadow-inner"
    >
      <div ref="boardRef" class="absolute inset-2">
        <button
          v-for="unit in units"
          :key="unit.key"
          type="button"
          class="absolute box-border border border-dashed border-border transition"
          :class="
            occupied[unit.row]?.[unit.col]
              ? 'pointer-events-none border-transparent'
              : 'hover:border-brand/50 hover:bg-brand/15'
          "
          :style="unitPercent(unit.row, unit.col)"
          :aria-label="t('customLayout.addCellAt', { row: unit.row, col: unit.col })"
          :tabindex="occupied[unit.row]?.[unit.col] ? -1 : 0"
          @click="onEmptyClick(unit.row, unit.col)"
        />

        <div
          v-for="(cell, index) in editor.cells"
          :key="`${cell.row}-${cell.col}-${cell.rowSpan}-${cell.colSpan}-${index}`"
          class="absolute box-border flex cursor-grab items-center justify-center rounded-sm border-2 select-none active:cursor-grabbing"
          :class="
            editor.selectedIndex === index
              ? 'z-20 border-brand-solid bg-brand/90 text-white shadow-md'
              : 'z-10 border-brand/50 bg-brand/50 text-brand-fg hover:bg-brand/85'
          "
          :style="cellPercent(cell)"
          @pointerdown="onBlockPointerDown(index, $event)"
        >
          <span class="pointer-events-none text-xs font-semibold">{{ index + 1 }}</span>
          <button
            v-if="editor.selectedIndex === index"
            type="button"
            class="absolute right-0 bottom-0 z-30 h-3.5 w-3.5 translate-x-1/3 translate-y-1/3 cursor-se-resize rounded-sm border border-white bg-brand-solid shadow"
            :aria-label="t('customLayout.resizeHandle')"
            @pointerdown="onResizePointerDown(index, $event)"
          />
        </div>
      </div>
    </div>
    <p v-if="editor.lastOpError" class="text-center text-xs text-warning-fg">
      {{ editor.lastOpError }}
    </p>
  </div>
</template>
