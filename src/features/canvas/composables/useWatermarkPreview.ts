import { computed, type ComputedRef, type Ref } from 'vue'
import type { CollageStyle } from '@/entities/session'
import {
  estimateTextSize,
  resolveWatermarkMode,
  resolveWatermarkPosition,
  watermarkSingleAnchor,
  watermarkTileOffsets,
} from '@/features/watermark'

export function useWatermarkPreview(
  style: ComputedRef<CollageStyle>,
  canvasSize:
    Ref<{ width: number; height: number }> | ComputedRef<{ width: number; height: number }>,
) {
  return computed(() => {
    const wm = style.value.watermark
    if (!wm.enabled || !wm.text.trim()) {
      return { mode: 'tile' as const, items: [] as Array<{ x: number; y: number }> }
    }
    const w = canvasSize.value.width
    const h = canvasSize.value.height
    if (w <= 0 || h <= 0) {
      return { mode: 'tile' as const, items: [] as Array<{ x: number; y: number }> }
    }
    const text = wm.text.trim()
    const metrics = estimateTextSize(text, wm.fontSize)
    const mode = resolveWatermarkMode(wm)
    if (mode === 'single') {
      const a = watermarkSingleAnchor(resolveWatermarkPosition(wm), w, h, metrics, wm.rotation)
      return { mode: 'single' as const, items: [{ x: a.x, y: a.y }] }
    }
    // Center-relative offsets (same metrics/step as drawWatermark).
    return {
      mode: 'tile' as const,
      items: watermarkTileOffsets(w, h, wm.fontSize, wm.density, metrics),
    }
  })
}
