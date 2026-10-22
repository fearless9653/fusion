import type { RegisteredImage } from '@/features/images'
import { loadImageElement } from './loadImageElement'
import type { RenderImageSource } from './renderCollage'

/**
 * Build the id → drawable map for renderCollage.
 * Prefers ImageBitmap; falls back to HTMLImageElement from objectUrl.
 */
export async function buildRenderImages(
  list: RegisteredImage[],
): Promise<Map<string, RenderImageSource>> {
  const map = new Map<string, RenderImageSource>()
  await Promise.all(
    list.map(async (img) => {
      if (img.bitmap) {
        map.set(img.id, {
          bitmap: img.bitmap,
          width: img.width,
          height: img.height,
        })
        return
      }
      try {
        const element = await loadImageElement(img.objectUrl)
        map.set(img.id, {
          element,
          width: img.width || element.naturalWidth,
          height: img.height || element.naturalHeight,
        })
      } catch {
        // Skip undrawable entries
      }
    }),
  )
  return map
}
