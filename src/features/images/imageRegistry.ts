import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  cellTransformsEqual,
  toCanonicalCellTransform,
  type CellImageTransform,
} from '@/entities/session'
import { decodeImage } from '@/shared/workers'
import { bakeOrientedImage, isIdentityOrientation } from './bakeOrientedImage'

export type RegisteredImage = {
  id: string
  name: string
  /** Object URL for <img> / CSS preview (revoke on remove). */
  objectUrl: string
  /** Decoded bitmap for canvas export; may be closed on remove. */
  bitmap: ImageBitmap | null
  width: number
  height: number
  mimeType: string
  /**
   * When set, this entry is an orientation bake of another registry image.
   * Removing the source cascades to all derived bakes.
   */
  derivedFromId: string | null
  /**
   * Canonical orientation baked into this entry (flipY always false).
   * Null for originals.
   */
  bakeTransform: CellImageTransform | null
}

let idSeq = 0

function nextImageId(): string {
  idSeq += 1
  return 'img_' + Date.now().toString(36) + '_' + idSeq
}

/**
 * In-memory image registry (blobs / bitmaps).
 * Not part of undo history — session only stores imageId references.
 */
export const useImageRegistry = defineStore('imageRegistry', () => {
  const images = ref<Map<string, RegisteredImage>>(new Map())
  const selectedImageId = ref<string | null>(null)
  const loadingCount = ref(0)

  const list = computed(() => Array.from(images.value.values()))
  const isLoading = computed(() => loadingCount.value > 0)

  function get(id: string): RegisteredImage | undefined {
    return images.value.get(id)
  }

  function select(id: string | null): void {
    selectedImageId.value = id
  }

  function put(entry: RegisteredImage): void {
    const next = new Map(images.value)
    next.set(entry.id, entry)
    images.value = next
  }

  function disposeEntry(entry: RegisteredImage): void {
    URL.revokeObjectURL(entry.objectUrl)
    entry.bitmap?.close?.()
  }

  /** Ids of orientation bakes derived from sourceId (not including source). */
  function derivedIdsOf(sourceId: string): string[] {
    const ids: string[] = []
    for (const entry of images.value.values()) {
      if (entry.derivedFromId === sourceId) ids.push(entry.id)
    }
    return ids
  }

  async function addFile(file: File): Promise<RegisteredImage> {
    loadingCount.value += 1
    try {
      const objectUrl = URL.createObjectURL(file)
      let bitmap: ImageBitmap | null = null
      let width = 0
      let height = 0
      try {
        const decoded = await decodeImage(file)
        bitmap = decoded.bitmap
        width = decoded.width
        height = decoded.height
      } catch {
        // Fallback dimensions via HTMLImageElement if worker/main decode fails.
        const size = await probeImageSize(objectUrl)
        width = size.width
        height = size.height
      }
      const entry: RegisteredImage = {
        id: nextImageId(),
        name: file.name || entryFallbackName(),
        objectUrl,
        bitmap,
        width,
        height,
        mimeType: file.type || 'image/*',
        derivedFromId: null,
        bakeTransform: null,
      }
      put(entry)
      return entry
    } finally {
      loadingCount.value = Math.max(0, loadingCount.value - 1)
    }
  }

  async function addFiles(files: FileList | File[]): Promise<RegisteredImage[]> {
    const listFiles = Array.from(files).filter((f) => f.type.startsWith('image/'))
    const added: RegisteredImage[] = []
    for (const file of listFiles) {
      added.push(await addFile(file))
    }
    return added
  }

  /** Find an existing bake of sourceId with the same canonical orientation. */
  function findDerivedBake(
    sourceId: string,
    transform: Partial<CellImageTransform> | null | undefined,
  ): RegisteredImage | undefined {
    const canonical = toCanonicalCellTransform(transform)
    for (const entry of images.value.values()) {
      if (
        entry.derivedFromId === sourceId &&
        entry.bakeTransform &&
        cellTransformsEqual(entry.bakeTransform, canonical)
      ) {
        return entry
      }
    }
    return undefined
  }

  /**
   * Create one orientation bake of sourceId, or reuse an existing derived with
   * the same source + canonical orientation. Always bakes from the original.
   */
  async function addBakedFrom(
    sourceId: string,
    transform: Partial<CellImageTransform> | null | undefined,
  ): Promise<RegisteredImage> {
    const canonical = toCanonicalCellTransform(transform)
    if (isIdentityOrientation(canonical)) {
      throw new Error('Refusing identity bake; use the source image id')
    }
    const existing = findDerivedBake(sourceId, canonical)
    if (existing) return existing
    const source = images.value.get(sourceId)
    if (!source) throw new Error('Source image not found: ' + sourceId)
    if (source.derivedFromId) {
      throw new Error('Cannot bake from an already-derived image; use the original source')
    }
    loadingCount.value += 1
    try {
      const baked = await bakeOrientedImage(
        {
          bitmap: source.bitmap,
          objectUrl: source.objectUrl,
          width: source.width,
          height: source.height,
        },
        canonical,
      )
      const objectUrl = URL.createObjectURL(baked.blob)
      const entry: RegisteredImage = {
        id: nextImageId(),
        name: source.name + ' (oriented)',
        objectUrl,
        bitmap: baked.bitmap,
        width: baked.width,
        height: baked.height,
        mimeType: baked.mimeType,
        derivedFromId: sourceId,
        bakeTransform: canonical,
      }
      put(entry)
      return entry
    } finally {
      loadingCount.value = Math.max(0, loadingCount.value - 1)
    }
  }

  function remove(id: string): void {
    const entry = images.value.get(id)
    if (!entry) return
    // Cascade: removing a source deletes all of its orientation bakes.
    const cascadeIds = entry.derivedFromId ? [] : derivedIdsOf(id)
    const next = new Map(images.value)
    for (const bakeId of cascadeIds) {
      const bake = next.get(bakeId)
      if (bake) {
        disposeEntry(bake)
        next.delete(bakeId)
        if (selectedImageId.value === bakeId) selectedImageId.value = null
      }
    }
    disposeEntry(entry)
    next.delete(id)
    images.value = next
    if (selectedImageId.value === id) {
      selectedImageId.value = null
    }
  }

  function clear(): void {
    for (const entry of images.value.values()) {
      disposeEntry(entry)
    }
    images.value = new Map()
    selectedImageId.value = null
  }

  /** Test / hot-reload helper. */
  function reset(): void {
    clear()
    idSeq = 0
  }

  return {
    images,
    list,
    selectedImageId,
    isLoading,
    get,
    select,
    addFile,
    addFiles,
    addBakedFrom,
    findDerivedBake,
    derivedIdsOf,
    remove,
    clear,
    reset,
  }
})

function entryFallbackName(): string {
  return 'image_' + idSeq
}

function probeImageSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = url
  })
}
