/** IndexedDB (or in-memory fallback) for the collage background image blob. */

export const STYLE_IDB_NAME = 'fusion-style'
export const STYLE_IDB_VERSION = 1
export const STYLE_IDB_STORE = 'blobs'
/** Stable object-store key — never an ephemeral registry `img_*` id. */
export const STYLE_BG_IDB_KEY = 'background'

const memoryFallback = new Map<string, Blob>()

function canUseIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined' && indexedDB !== null
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(STYLE_IDB_NAME, STYLE_IDB_VERSION)
    req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'))
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STYLE_IDB_STORE)) {
        db.createObjectStore(STYLE_IDB_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
  })
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('indexedDB request failed'))
  })
}

/** Persist the background blob under the stable key. */
export async function putStyleBackgroundBlob(blob: Blob): Promise<void> {
  if (!canUseIndexedDb()) {
    memoryFallback.set(STYLE_BG_IDB_KEY, blob)
    return
  }
  const db = await openDb()
  try {
    const tx = db.transaction(STYLE_IDB_STORE, 'readwrite')
    const store = tx.objectStore(STYLE_IDB_STORE)
    await idbReq(store.put(blob, STYLE_BG_IDB_KEY))
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('indexedDB tx failed'))
      tx.onabort = () => reject(tx.error ?? new Error('indexedDB tx aborted'))
    })
  } finally {
    db.close()
  }
}

/** Read the persisted background blob, or null if missing. */
export async function getStyleBackgroundBlob(): Promise<Blob | null> {
  if (!canUseIndexedDb()) {
    return memoryFallback.get(STYLE_BG_IDB_KEY) ?? null
  }
  const db = await openDb()
  try {
    const tx = db.transaction(STYLE_IDB_STORE, 'readonly')
    const store = tx.objectStore(STYLE_IDB_STORE)
    const value = await idbReq(store.get(STYLE_BG_IDB_KEY))
    if (value instanceof Blob) return value
    return null
  } finally {
    db.close()
  }
}

/** Delete the persisted background blob (no-op if absent). */
export async function deleteStyleBackgroundBlob(): Promise<void> {
  if (!canUseIndexedDb()) {
    memoryFallback.delete(STYLE_BG_IDB_KEY)
    return
  }
  const db = await openDb()
  try {
    const tx = db.transaction(STYLE_IDB_STORE, 'readwrite')
    const store = tx.objectStore(STYLE_IDB_STORE)
    await idbReq(store.delete(STYLE_BG_IDB_KEY))
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('indexedDB tx failed'))
      tx.onabort = () => reject(tx.error ?? new Error('indexedDB tx aborted'))
    })
  } finally {
    db.close()
  }
}

/** Test helper: clear the in-memory IDB fallback (jsdom has no indexedDB). */
export function resetStyleBackgroundIdbForTests(): void {
  memoryFallback.clear()
}
