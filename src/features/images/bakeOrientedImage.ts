/** Bake cell orientation into a new bitmap (eager rotate/flip). */

import type { CellImageTransform } from '@/entities/session'
import { isIdentityCellTransform, toCanonicalCellTransform } from '@/entities/session'
import { bakeOrientedImageViaWorker, type BakedImageResult } from '@/shared/workers/bakeImage'

export type BakeImageSource = {
  bitmap?: ImageBitmap | null
  /** Object URL or other createImageBitmap-compatible source. */
  objectUrl?: string
  width: number
  height: number
  mimeType?: string
}

export type BakedOrientedImage = {
  bitmap: ImageBitmap
  blob: Blob
  width: number
  height: number
  mimeType: string
}

function toPublicResult(baked: BakedImageResult): BakedOrientedImage {
  return {
    bitmap: baked.bitmap,
    blob: baked.blob,
    width: baked.width,
    height: baked.height,
    mimeType: baked.mimeType,
  }
}

/**
 * Draw the full source into a new bitmap with flip-then-rotate.
 * Prefers a Web Worker + OffscreenCanvas (ImageBitmap transfer); falls back to main thread.
 * Output size swaps on 90/270. Used so preview/export can treat display as identity.
 * No max-edge downscale — full source resolution is preserved.
 */
export async function bakeOrientedImage(
  source: BakeImageSource,
  transform?: Partial<CellImageTransform> | null,
): Promise<BakedOrientedImage> {
  const tf = toCanonicalCellTransform(transform)
  const baked = await bakeOrientedImageViaWorker(
    {
      bitmap: source.bitmap,
      objectUrl: source.objectUrl,
      width: source.width,
      height: source.height,
      mimeType: source.mimeType,
    },
    {
      rotation: tf.rotation,
      flipX: tf.flipX,
      flipY: tf.flipY,
    },
  )
  return toPublicResult(baked)
}

/** Alias of isIdentityCellTransform for image-bake call sites. */
export function isIdentityOrientation(transform?: Partial<CellImageTransform> | null): boolean {
  return isIdentityCellTransform(transform)
}
