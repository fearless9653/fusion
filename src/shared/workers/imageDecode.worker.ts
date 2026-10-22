/**
 * Image decode worker — creates an ImageBitmap from transferred bytes.
 */
import { isImageDecodeRequest, type ImageDecodeResponse } from './imageDecode.types'

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope

ctx.postMessage({ type: 'ready' } satisfies ImageDecodeResponse)

ctx.addEventListener('message', async (event: MessageEvent<unknown>) => {
  const data = event.data
  if (!isImageDecodeRequest(data)) {
    const response: ImageDecodeResponse = {
      type: 'error',
      message: 'Invalid decode request',
    }
    ctx.postMessage(response)
    return
  }

  try {
    const blob = new Blob([data.buffer], {
      type: data.mimeType || 'application/octet-stream',
    })
    const bitmap = await createImageBitmap(blob)
    const response: ImageDecodeResponse = {
      type: 'decoded',
      id: data.id,
      bitmap,
      width: bitmap.width,
      height: bitmap.height,
    }
    ctx.postMessage(response, [bitmap])
  } catch (err) {
    const response: ImageDecodeResponse = {
      type: 'error',
      id: data.id,
      message: err instanceof Error ? err.message : 'Decode failed',
    }
    ctx.postMessage(response)
  }
})

export {}
