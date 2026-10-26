/**
 * Message contract between the main thread and imageBake.worker.
 * Keep this module free of Worker globals so Vitest can import it in Node.
 */

export type ImageBakeRotation = 0 | 90 | 180 | 270

export type ImageBakeRequest = {
  type: 'bake'
  id: string
  /** Source pixel size (before orientation). */
  width: number
  height: number
  rotation: ImageBakeRotation
  flipX: boolean
  flipY: boolean
  /** Prefer transferred ImageBitmap (clone); else buffer + mimeType. */
  bitmap?: ImageBitmap
  buffer?: ArrayBuffer
  mimeType?: string
}

export type ImageBakeSuccess = {
  type: 'baked'
  id: string
  /** Transferable baked ImageBitmap. */
  bitmap: ImageBitmap
  /** PNG (or mimeType) bytes for object URL (transferable). */
  buffer: ArrayBuffer
  width: number
  height: number
  mimeType: string
}

export type ImageBakeError = {
  type: 'error'
  id?: string
  message: string
}

export type ImageBakeReady = {
  type: 'ready'
}

export type ImageBakeResponse = ImageBakeReady | ImageBakeSuccess | ImageBakeError

export function isImageBakeRequest(data: unknown): data is ImageBakeRequest {
  if (!data || typeof data !== 'object') return false
  const msg = data as Record<string, unknown>
  if (msg.type !== 'bake' || typeof msg.id !== 'string') return false
  if (typeof msg.width !== 'number' || typeof msg.height !== 'number') return false
  if (typeof msg.rotation !== 'number' || typeof msg.flipX !== 'boolean') return false
  if (typeof msg.flipY !== 'boolean') return false
  const hasBitmap = typeof ImageBitmap !== 'undefined' && msg.bitmap instanceof ImageBitmap
  const hasBuffer = msg.buffer instanceof ArrayBuffer
  return hasBitmap || hasBuffer
}

export function isImageBakeResponse(data: unknown): data is ImageBakeResponse {
  if (!data || typeof data !== 'object') return false
  const msg = data as Record<string, unknown>
  if (msg.type === 'ready') return true
  if (msg.type === 'error' && typeof msg.message === 'string') return true
  if (
    msg.type === 'baked' &&
    typeof msg.id === 'string' &&
    typeof msg.width === 'number' &&
    typeof msg.height === 'number' &&
    typeof msg.mimeType === 'string' &&
    msg.buffer instanceof ArrayBuffer
  ) {
    return true
  }
  return false
}
