import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { decodeImage } from '@/shared/workers'

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
}

let idSeq = 0

function nextImageId(): string {
  idSeq += 1
  return `img_${Date.now().toString(36)}_${idSeq}`
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
      }
      const next = new Map(images.value)
      next.set(entry.id, entry)
      images.value = next
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

  function remove(id: string): void {
    const entry = images.value.get(id)
    if (!entry) return
    URL.revokeObjectURL(entry.objectUrl)
    entry.bitmap?.close?.()
    const next = new Map(images.value)
    next.delete(id)
    images.value = next
    if (selectedImageId.value === id) {
      selectedImageId.value = null
    }
  }

  function clear(): void {
    for (const entry of images.value.values()) {
      URL.revokeObjectURL(entry.objectUrl)
      entry.bitmap?.close?.()
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
    remove,
    clear,
    reset,
  }
})

function entryFallbackName(): string {
  return `image_${idSeq}`
}

function probeImageSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = url
  })
}
