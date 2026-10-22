/**
 * Largest width×height that fits inside the container while preserving ratioW:ratioH.
 * Used by the collage preview stage (contain-fit).
 */
export function fitAspectRect(
  containerW: number,
  containerH: number,
  ratioW: number,
  ratioH: number,
): { width: number; height: number } {
  if (containerW <= 0 || containerH <= 0 || ratioW <= 0 || ratioH <= 0) {
    return { width: 0, height: 0 }
  }
  const target = ratioW / ratioH
  const container = containerW / containerH
  if (container > target) {
    // Wider than needed — height-constrained
    const height = containerH
    return { width: height * target, height }
  }
  // Taller / narrower — width-constrained
  const width = containerW
  return { width, height: width / target }
}
