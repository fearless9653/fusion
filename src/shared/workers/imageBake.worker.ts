/**
 * Orientation bake worker — draws flip-then-rotate onto OffscreenCanvas off the main thread.
 */
import { drawOrientedImage, orientedOutputSize } from './bakeOrientedCanvas'
import { isImageBakeRequest, type ImageBakeResponse } from './imageBake.types'

type WorkerScope = {
  postMessage(message: ImageBakeResponse, transfer?: Transferable[]): void
  addEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void
}
const ctx: WorkerScope = self as unknown as WorkerScope

ctx.postMessage({ type: 'ready' } satisfies ImageBakeResponse)

ctx.addEventListener('message', async (event: MessageEvent<unknown>) => {
  const data = event.data
  if (!isImageBakeRequest(data)) {
    const response: ImageBakeResponse = {
      type: 'error',
      message: 'Invalid bake request',
    }
    ctx.postMessage(response)
    return
  }

  if (typeof OffscreenCanvas === 'undefined') {
    const response: ImageBakeResponse = {
      type: 'error',
      id: data.id,
      message: 'OffscreenCanvas unavailable in bake worker',
    }
    ctx.postMessage(response)
    return
  }

  let transferredBitmap: ImageBitmap | null = data.bitmap ?? null
  try {
    const srcW = data.width
    const srcH = data.height
    if (srcW <= 0 || srcH <= 0) {
      throw new Error('Invalid source size for orientation bake')
    }

    let drawable: ImageBitmap
    if (transferredBitmap) {
      drawable = transferredBitmap
    } else if (data.buffer) {
      const blob = new Blob([data.buffer], {
        type: data.mimeType || 'application/octet-stream',
      })
      drawable = await createImageBitmap(blob)
      transferredBitmap = drawable
    } else {
      throw new Error('No drawable source for orientation bake')
    }

    const { outW, outH } = orientedOutputSize(srcW, srcH, data.rotation)
    const canvas = new OffscreenCanvas(outW, outH)
    const canvasCtx = canvas.getContext('2d')
    if (!canvasCtx) throw new Error('2D context unavailable for orientation bake')

    drawOrientedImage(canvasCtx, drawable, srcW, srcH, outW, outH, {
      rotation: data.rotation,
      flipX: data.flipX,
      flipY: data.flipY,
    })

    const mimeType = 'image/png'
    const blob = await canvas.convertToBlob({ type: mimeType })
    const bitmap = await createImageBitmap(canvas)
    const buffer = await blob.arrayBuffer()

    const response: ImageBakeResponse = {
      type: 'baked',
      id: data.id,
      bitmap,
      buffer,
      width: outW,
      height: outH,
      mimeType,
    }
    ctx.postMessage(response, [bitmap, buffer])
  } catch (err) {
    const response: ImageBakeResponse = {
      type: 'error',
      id: data.id,
      message: err instanceof Error ? err.message : 'Bake failed',
    }
    ctx.postMessage(response)
  } finally {
    transferredBitmap?.close?.()
  }
})

export {}
