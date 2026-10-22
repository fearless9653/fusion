import type { ImageDecodeRequest, ImageDecodeResponse } from './imageDecode.types'
import { isImageDecodeResponse } from './imageDecode.types'

export type DecodedImage = {
  bitmap: ImageBitmap
  width: number
  height: number
  /** True when decoded on the main thread after worker failure / unavailability. */
  usedFallback: boolean
}

type Pending = {
  resolve: (value: DecodedImage) => void
  reject: (reason: Error) => void
}

let sharedWorker: Worker | null = null
let workerFailed = false
let nextId = 0
const pending = new Map<string, Pending>()

function createWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null
  try {
    // Vite worker import
    const worker = new Worker(new URL('./imageDecode.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.addEventListener('message', onWorkerMessage)
    worker.addEventListener('error', () => {
      workerFailed = true
      failAllPending('Image decode worker crashed')
      sharedWorker = null
    })
    return worker
  } catch {
    workerFailed = true
    return null
  }
}

function onWorkerMessage(event: MessageEvent<unknown>): void {
  if (!isImageDecodeResponse(event.data)) return
  const data = event.data
  if (data.type === 'ready') return
  if (data.type === 'error') {
    if (!data.id) return
    const entry = pending.get(data.id)
    if (!entry) return
    pending.delete(data.id)
    entry.reject(new Error(data.message))
    return
  }
  if (data.type === 'decoded') {
    const entry = pending.get(data.id)
    if (!entry) {
      data.bitmap.close?.()
      return
    }
    pending.delete(data.id)
    entry.resolve({
      bitmap: data.bitmap,
      width: data.width,
      height: data.height,
      usedFallback: false,
    })
  }
}

function failAllPending(message: string): void {
  for (const [id, entry] of pending) {
    entry.reject(new Error(message))
    pending.delete(id)
  }
}

async function decodeOnMainThread(blob: Blob): Promise<DecodedImage> {
  const bitmap = await createImageBitmap(blob)
  return {
    bitmap,
    width: bitmap.width,
    height: bitmap.height,
    usedFallback: true,
  }
}

/**
 * Decode a File/Blob to ImageBitmap via worker, falling back to main-thread createImageBitmap.
 */
export async function decodeImage(source: Blob): Promise<DecodedImage> {
  if (workerFailed || typeof Worker === 'undefined') {
    return decodeOnMainThread(source)
  }

  if (!sharedWorker) {
    sharedWorker = createWorker()
  }
  if (!sharedWorker) {
    return decodeOnMainThread(source)
  }

  const id = `img_${nextId++}`
  const buffer = await source.arrayBuffer()
  const mimeType = source.type || undefined

  return new Promise<DecodedImage>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    const request: ImageDecodeRequest = {
      type: 'decode',
      id,
      buffer,
      mimeType,
    }
    try {
      sharedWorker!.postMessage(request, [buffer])
    } catch (err) {
      pending.delete(id)
      workerFailed = true
      void decodeOnMainThread(source).then(resolve, reject)
      void err
    }
  }).catch(async (err) => {
    // Worker responded with error — try main-thread fallback once.
    try {
      return await decodeOnMainThread(source)
    } catch {
      throw err instanceof Error ? err : new Error(String(err))
    }
  })
}

/** Test helper: reset singleton worker state. */
export function resetDecodeImageClient(): void {
  if (sharedWorker) {
    sharedWorker.terminate()
    sharedWorker = null
  }
  workerFailed = false
  pending.clear()
  nextId = 0
}

/** Pure helper for tests: build a decode request payload. */
export function buildDecodeRequest(
  id: string,
  buffer: ArrayBuffer,
  mimeType?: string,
): ImageDecodeRequest {
  return { type: 'decode', id, buffer, mimeType }
}

/** Pure helper for tests: classify a worker response. */
export function parseWorkerResponse(data: unknown): ImageDecodeResponse | null {
  return isImageDecodeResponse(data) ? data : null
}
