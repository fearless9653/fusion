import type { ImageBakeRequest, ImageBakeResponse } from './imageBake.types'
import { isImageBakeResponse } from './imageBake.types'
import { drawOrientedImage, orientedOutputSize } from './bakeOrientedCanvas'

export type BakedImageResult = {
  bitmap: ImageBitmap
  blob: Blob
  width: number
  height: number
  mimeType: string
  /** True when baked on the main thread after worker failure / unavailability. */
  usedFallback: boolean
}

export type BakeWorkerSource = {
  bitmap?: ImageBitmap | null
  objectUrl?: string
  width: number
  height: number
  mimeType?: string
}

export type BakeWorkerTransform = {
  rotation: 0 | 90 | 180 | 270
  flipX: boolean
  flipY: boolean
}

type Pending = {
  resolve: (value: BakedImageResult) => void
  reject: (reason: Error) => void
}

let sharedWorker: Worker | null = null
let workerFailed = false
let nextId = 0
const pending = new Map<string, Pending>()

function workerSupported(): boolean {
  return (
    typeof Worker !== 'undefined' &&
    typeof OffscreenCanvas !== 'undefined' &&
    typeof createImageBitmap === 'function'
  )
}

function createWorker(): Worker | null {
  if (!workerSupported()) return null
  try {
    const worker = new Worker(new URL('./imageBake.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.addEventListener('message', onWorkerMessage)
    worker.addEventListener('error', () => {
      workerFailed = true
      failAllPending('Image bake worker crashed')
      sharedWorker = null
    })
    return worker
  } catch {
    workerFailed = true
    return null
  }
}

function onWorkerMessage(event: MessageEvent<unknown>): void {
  if (!isImageBakeResponse(event.data)) return
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
  if (data.type === 'baked') {
    const entry = pending.get(data.id)
    if (!entry) {
      data.bitmap.close?.()
      return
    }
    pending.delete(data.id)
    entry.resolve({
      bitmap: data.bitmap,
      blob: new Blob([data.buffer], { type: data.mimeType || 'image/png' }),
      width: data.width,
      height: data.height,
      mimeType: data.mimeType,
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

function createBakeCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height)
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

async function canvasToBlob(canvas: OffscreenCanvas | HTMLCanvasElement): Promise<Blob> {
  if ('convertToBlob' in canvas && typeof canvas.convertToBlob === 'function') {
    return canvas.convertToBlob({ type: 'image/png' })
  }
  return new Promise((resolve, reject) => {
    ;(canvas as HTMLCanvasElement).toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Failed to encode baked image'))
    }, 'image/png')
  })
}

async function resolveDrawable(source: BakeWorkerSource): Promise<CanvasImageSource> {
  if (source.bitmap) return source.bitmap
  if (source.objectUrl) {
    const res = await fetch(source.objectUrl)
    const blob = await res.blob()
    return createImageBitmap(blob)
  }
  throw new Error('No drawable source for orientation bake')
}

/** Main-thread bake (fallback when worker / OffscreenCanvas unavailable). */
export async function bakeOrientedImageOnMainThread(
  source: BakeWorkerSource,
  transform: BakeWorkerTransform,
): Promise<BakedImageResult> {
  const srcW = source.width
  const srcH = source.height
  if (srcW <= 0 || srcH <= 0) {
    throw new Error('Invalid source size for orientation bake')
  }
  const { outW, outH } = orientedOutputSize(srcW, srcH, transform.rotation)
  const drawable = await resolveDrawable(source)
  const canvas = createBakeCanvas(outW, outH)
  const ctx = canvas.getContext('2d') as
    CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
  if (!ctx) throw new Error('2D context unavailable for orientation bake')

  drawOrientedImage(ctx, drawable, srcW, srcH, outW, outH, transform)

  const blob = await canvasToBlob(canvas)
  const bitmap = await createImageBitmap(canvas)
  return {
    bitmap,
    blob,
    width: outW,
    height: outH,
    mimeType: 'image/png',
    usedFallback: true,
  }
}

async function prepareTransferables(source: BakeWorkerSource): Promise<{
  bitmap?: ImageBitmap
  buffer?: ArrayBuffer
  mimeType?: string
  transfer: Transferable[]
}> {
  if (source.bitmap && typeof createImageBitmap === 'function') {
    // Clone so the registry's source bitmap is not neutered by transfer.
    const clone = await createImageBitmap(source.bitmap)
    return { bitmap: clone, transfer: [clone] }
  }
  if (source.objectUrl) {
    const res = await fetch(source.objectUrl)
    const blob = await res.blob()
    const buffer = await blob.arrayBuffer()
    return {
      buffer,
      mimeType: source.mimeType || blob.type || undefined,
      transfer: [buffer],
    }
  }
  throw new Error('No drawable source for orientation bake')
}

/**
 * Bake orientation via worker (ImageBitmap transfer), falling back to main thread.
 */
export async function bakeOrientedImageViaWorker(
  source: BakeWorkerSource,
  transform: BakeWorkerTransform,
): Promise<BakedImageResult> {
  if (workerFailed || !workerSupported()) {
    return bakeOrientedImageOnMainThread(source, transform)
  }

  if (!sharedWorker) {
    sharedWorker = createWorker()
  }
  if (!sharedWorker) {
    return bakeOrientedImageOnMainThread(source, transform)
  }

  const id = `bake_${nextId++}`
  let prepared: Awaited<ReturnType<typeof prepareTransferables>>
  try {
    prepared = await prepareTransferables(source)
  } catch {
    return bakeOrientedImageOnMainThread(source, transform)
  }

  return new Promise<BakedImageResult>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    const request: ImageBakeRequest = {
      type: 'bake',
      id,
      width: source.width,
      height: source.height,
      rotation: transform.rotation,
      flipX: transform.flipX,
      flipY: transform.flipY,
      bitmap: prepared.bitmap,
      buffer: prepared.buffer,
      mimeType: prepared.mimeType,
    }
    try {
      sharedWorker!.postMessage(request, prepared.transfer)
    } catch (err) {
      pending.delete(id)
      prepared.bitmap?.close?.()
      workerFailed = true
      void bakeOrientedImageOnMainThread(source, transform).then(resolve, reject)
      void err
    }
  }).catch(async (err) => {
    try {
      return await bakeOrientedImageOnMainThread(source, transform)
    } catch {
      throw err instanceof Error ? err : new Error(String(err))
    }
  })
}

/** Test helper: reset singleton worker state. */
export function resetBakeImageClient(): void {
  if (sharedWorker) {
    sharedWorker.terminate()
    sharedWorker = null
  }
  workerFailed = false
  pending.clear()
  nextId = 0
}

/** Pure helper for tests: build a bake request payload. */
export function buildBakeRequest(
  id: string,
  partial: Omit<ImageBakeRequest, 'type' | 'id'>,
): ImageBakeRequest {
  return { type: 'bake', id, ...partial }
}

/** Pure helper for tests: classify a worker response. */
export function parseBakeWorkerResponse(data: unknown): ImageBakeResponse | null {
  return isImageBakeResponse(data) ? data : null
}
