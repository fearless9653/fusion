/** Soft boundary limits for local-only crash / abuse guards (P2). */

/** Soft cap on layout JSON paste / import text before parse (256 KiB). */
export const LAYOUT_JSON_MAX_BYTES = 256 * 1024

/** Soft cap on user-added image file size (~40 MiB) to reduce browser OOM risk. */
export const IMAGE_FILE_MAX_BYTES = 40 * 1024 * 1024

/** Soft cap on decoded image max edge (naturalWidth / naturalHeight) in pixels. */
export const IMAGE_MAX_EDGE_PX = 8192

/** UTF-8 byte length of a string (for JSON paste/import size checks). */
export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

/** True when layout JSON text exceeds LAYOUT_JSON_MAX_BYTES. */
export function isLayoutJsonOversize(text: string): boolean {
  return utf8ByteLength(text) > LAYOUT_JSON_MAX_BYTES
}
