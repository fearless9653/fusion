/**
 * Message contract between the main thread and imageDecode.worker.
 * Keep this module free of Worker globals so Vitest can import it in Node.
 */

export type ImageDecodeRequest = {
  type: 'decode'
  id: string
  /** Image bytes (transferable). */
  buffer: ArrayBuffer
  mimeType?: string
}

export type ImageDecodeSuccess = {
  type: 'decoded'
  id: string
  /** Transferable ImageBitmap when worker path succeeds. */
  bitmap: ImageBitmap
  width: number
  height: number
}

export type ImageDecodeError = {
  type: 'error'
  id?: string
  message: string
}

export type ImageDecodeReady = {
  type: 'ready'
}

export type ImageDecodeResponse = ImageDecodeReady | ImageDecodeSuccess | ImageDecodeError

export function isImageDecodeRequest(data: unknown): data is ImageDecodeRequest {
  if (!data || typeof data !== 'object') return false
  const msg = data as Record<string, unknown>
  return msg.type === 'decode' && typeof msg.id === 'string' && msg.buffer instanceof ArrayBuffer
}

export function isImageDecodeResponse(data: unknown): data is ImageDecodeResponse {
  if (!data || typeof data !== 'object') return false
  const msg = data as Record<string, unknown>
  if (msg.type === 'ready') return true
  if (msg.type === 'error' && typeof msg.message === 'string') return true
  if (
    msg.type === 'decoded' &&
    typeof msg.id === 'string' &&
    typeof msg.width === 'number' &&
    typeof msg.height === 'number'
  ) {
    return true
  }
  return false
}
