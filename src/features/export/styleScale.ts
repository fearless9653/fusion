/**
 * Map preview-frame style pixels (spacing / radius / borders) onto export pixels.
 * Preview CSS uses the same numeric values as session style; export canvases are
 * much larger, so we scale by exportWidth / previewWidth.
 */

export function stylePxScale(exportWidth: number, previewWidth: number): number {
  if (
    !(exportWidth > 0) ||
    !(previewWidth > 0) ||
    !Number.isFinite(exportWidth) ||
    !Number.isFinite(previewWidth)
  ) {
    return 1
  }
  return exportWidth / previewWidth
}

export function scaleStyleLengths(
  style: {
    spacing: number
    radius: number
    borders: { top: number; right: number; bottom: number; left: number }
  },
  scale: number,
): {
  spacing: number
  radius: number
  borders: { top: number; right: number; bottom: number; left: number }
} {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1
  return {
    spacing: Math.max(0, style.spacing * s),
    radius: Math.max(0, style.radius * s),
    borders: {
      top: Math.max(0, style.borders.top * s),
      right: Math.max(0, style.borders.right * s),
      bottom: Math.max(0, style.borders.bottom * s),
      left: Math.max(0, style.borders.left * s),
    },
  }
}
