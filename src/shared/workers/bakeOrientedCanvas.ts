/**
 * Shared orientation draw helpers for main-thread fallback and imageBake.worker.
 * No Worker / document globals — safe for Vitest.
 */

export type BakeDrawTransform = {
  rotation: 0 | 90 | 180 | 270
  flipX: boolean
  flipY: boolean
}

export function orientedOutputSize(
  srcW: number,
  srcH: number,
  rotation: BakeDrawTransform['rotation'],
): { outW: number; outH: number } {
  const swap = rotation === 90 || rotation === 270
  return { outW: swap ? srcH : srcW, outH: swap ? srcW : srcH }
}

/**
 * Flip-then-rotate into outW×outH (caller sizes the canvas).
 */
export function drawOrientedImage(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  drawable: CanvasImageSource,
  srcW: number,
  srcH: number,
  outW: number,
  outH: number,
  tf: BakeDrawTransform,
): void {
  ctx.save()
  ctx.translate(outW / 2, outH / 2)
  ctx.rotate((tf.rotation * Math.PI) / 180)
  ctx.scale(tf.flipX ? -1 : 1, tf.flipY ? -1 : 1)
  ctx.drawImage(drawable, -srcW / 2, -srcH / 2, srcW, srcH)
  ctx.restore()
}
