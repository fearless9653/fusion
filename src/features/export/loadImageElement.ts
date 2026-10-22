/**
 * Load an HTMLImageElement from a URL (object URL or remote).
 * Used when ImageBitmap is unavailable for canvas draw.
 */
export function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image element'))
    img.src = url
  })
}
