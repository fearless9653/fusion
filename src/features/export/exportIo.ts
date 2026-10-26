import type { CollageStyle } from '@/entities/session'

export async function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('canvas.toBlob returned null'))
          return
        }
        resolve(blob)
      },
      mimeType,
      quality,
    )
  })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * Copy image blob to clipboard; returns false when ClipboardItem is unavailable
 * (caller should fall back to download).
 */
export async function copyBlobToClipboard(blob: Blob): Promise<boolean> {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
    return false
  }
  // Prefer PNG for clipboard; convert if needed is left to caller.
  try {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
    return true
  } catch {
    return false
  }
}

export function exportFilename(extension: 'jpg' | 'png'): string {
  const now = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  const unique = crypto.randomUUID().slice(0, 8)
  return `fusion-${stamp}-${unique}.${extension}`
}

/** JPEG quality for toBlob based on downloadQuality. */
export function jpegQualityFor(style: CollageStyle): number | undefined {
  if (style.downloadQuality === 'png') return undefined
  return style.downloadQuality === 'medium-jpg' ? 0.82 : 0.92
}
