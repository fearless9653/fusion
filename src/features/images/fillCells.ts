/**
 * Assign registered image ids into collage cells.
 * Used by library upload, cell click/drop, and page-level drop.
 */

export type CellImageRef = { imageId: string | null }

/**
 * Place `imageIds` starting at `startIndex` (always overwrite that cell),
 * then fill subsequent **empty** cells in order.
 * Returns how many ids were assigned.
 */
export function assignImagesFromIndex(
  cellImages: CellImageRef[],
  imageIds: string[],
  startIndex: number,
  assignImage: (cellIndex: number, imageId: string | null) => void,
): number {
  if (imageIds.length === 0) return 0
  if (startIndex < 0 || startIndex >= cellImages.length) return 0

  let cursor = 0
  assignImage(startIndex, imageIds[cursor]!)
  cursor += 1

  for (let i = startIndex + 1; i < cellImages.length && cursor < imageIds.length; i += 1) {
    if (!cellImages[i]?.imageId) {
      assignImage(i, imageIds[cursor]!)
      cursor += 1
    }
  }
  return cursor
}

/**
 * Fill empty cells from the start of the grid (library / page drop).
 * Returns how many ids were assigned.
 */
export function fillEmptyCells(
  cellImages: CellImageRef[],
  imageIds: string[],
  assignImage: (cellIndex: number, imageId: string | null) => void,
): number {
  if (imageIds.length === 0) return 0
  let cursor = 0
  for (let i = 0; i < cellImages.length && cursor < imageIds.length; i += 1) {
    if (!cellImages[i]?.imageId) {
      assignImage(i, imageIds[cursor]!)
      cursor += 1
    }
  }
  return cursor
}

/** True when the DataTransfer looks like file drag (OS files). */
export function isFileDrag(dt: DataTransfer | null | undefined): boolean {
  if (!dt) return false
  if (dt.types.includes('Files')) return true
  // Some browsers only expose items during dragover
  return Array.from(dt.items ?? []).some((item) => item.kind === 'file')
}

export function imageFilesFromList(files: FileList | File[] | null | undefined): File[] {
  if (!files) return []
  return Array.from(files).filter((f) => f.type.startsWith('image/'))
}
