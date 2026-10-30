import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ASPECT_SIDE_MAX,
  DEFAULT_STYLE,
  STYLE_LENGTH_MAX,
  WATERMARK_DENSITY_MAX,
  WATERMARK_FONT_SIZE_MAX,
  WATERMARK_FONT_SIZE_MIN,
  WATERMARK_ROTATION_MAX,
  WATERMARK_ROTATION_MIN,
} from '@/entities/session'
import { useImageRegistry } from '@/features/images'
import { setStylePersistDebounceMsForTests, useCollageStore } from './collageStore'
import { resetStyleBackgroundIdbForTests } from './styleBackgroundIdb'
import {
  STYLE_BG_MARKER,
  STYLE_STORAGE_KEY,
  clearPersistedStyleAndBackground,
  clearPersistedStyleJson,
  loadPersistedBackgroundBlob,
  parsePersistedStyle,
  persistFullStyle,
  readPersistedStyle,
  styleForStorage,
  writePersistedStyleJson,
} from './stylePersistence'

describe('stylePersistence', () => {
  beforeEach(() => {
    localStorage.clear()
    resetStyleBackgroundIdbForTests()
  })

  afterEach(() => {
    localStorage.clear()
    resetStyleBackgroundIdbForTests()
  })

  it('styleForStorage remaps registry imageId to stable IDB marker', () => {
    const style = structuredClone(DEFAULT_STYLE)
    style.spacing = 42
    style.background.color = '#112233'
    style.background.imageId = 'img_abc_1'
    const stored = styleForStorage(style)
    expect(stored.background.imageId).toBe(STYLE_BG_MARKER)
    expect(stored.spacing).toBe(42)
    expect(stored.background.color).toBe('#112233')
    expect(style.background.imageId).toBe('img_abc_1')
  })

  it('write/read round-trips style JSON without raw img_* ids', () => {
    const style = structuredClone(DEFAULT_STYLE)
    style.radius = 33
    style.downloadQuality = 'png'
    style.watermark.enabled = true
    style.watermark.text = 'Fusion'
    style.background.imageId = 'img_should_not_persist'
    const result = writePersistedStyleJson(style)
    expect(result.ok).toBe(true)
    const raw = JSON.parse(localStorage.getItem(STYLE_STORAGE_KEY)!)
    expect(raw.schemaVersion).toBe(1)
    expect(raw.style.background.imageId).toBe(STYLE_BG_MARKER)
    expect(raw.style.background.imageId).not.toMatch(/^img_/)

    const loaded = readPersistedStyle()
    expect(loaded?.radius).toBe(33)
    expect(loaded?.downloadQuality).toBe('png')
    expect(loaded?.watermark.text).toBe('Fusion')
    expect(loaded?.background.imageId).toBe(STYLE_BG_MARKER)
  })

  it('parsePersistedStyle truncates watermark text longer than WATERMARK_TEXT_MAX_LENGTH', () => {
    const long = 'x'.repeat(50)
    const parsed = parsePersistedStyle({
      schemaVersion: 1,
      style: {
        ...DEFAULT_STYLE,
        watermark: { ...DEFAULT_STYLE.watermark, text: long },
      },
    })
    expect(parsed?.watermark.text).toBe(long.slice(0, 32))
    expect(parsed?.watermark.text.length).toBe(32)
  })

  it('parsePersistedStyle clamps watermark fontSize, rotation, and density to UI ranges', () => {
    const parsed = parsePersistedStyle({
      schemaVersion: 1,
      style: {
        ...DEFAULT_STYLE,
        watermark: {
          ...DEFAULT_STYLE.watermark,
          fontSize: 999,
          rotation: -180,
          density: 99,
        },
      },
    })
    expect(parsed?.watermark.fontSize).toBe(WATERMARK_FONT_SIZE_MAX)
    expect(parsed?.watermark.rotation).toBe(WATERMARK_ROTATION_MIN)
    expect(parsed?.watermark.density).toBe(WATERMARK_DENSITY_MAX)

    const low = parsePersistedStyle({
      schemaVersion: 1,
      style: {
        ...DEFAULT_STYLE,
        watermark: {
          ...DEFAULT_STYLE.watermark,
          fontSize: 1,
          rotation: 180,
          density: 0,
        },
      },
    })
    expect(low?.watermark.fontSize).toBe(WATERMARK_FONT_SIZE_MIN)
    expect(low?.watermark.rotation).toBe(WATERMARK_ROTATION_MAX)
    expect(low?.watermark.density).toBe(1)
  })

  it('parsePersistedStyle clamps aspect sides to ASPECT_SIDE_MAX', () => {
    const parsed = parsePersistedStyle({
      schemaVersion: 1,
      style: {
        ...DEFAULT_STYLE,
        aspectRatio: { width: 50000, height: 0.5 },
        aspectSource: 'custom',
      },
    })
    expect(parsed?.aspectRatio).toEqual({ width: ASPECT_SIDE_MAX, height: 1 })
  })

  it('parsePersistedStyle clamps oversized spacing, radius, and borders to STYLE_LENGTH_MAX', () => {
    const parsed = parsePersistedStyle({
      schemaVersion: 1,
      style: {
        ...DEFAULT_STYLE,
        spacing: 999,
        radius: 120.6,
        borders: { top: 100, right: -3, bottom: 80.4, left: 40.2 },
      },
    })
    expect(parsed?.spacing).toBe(STYLE_LENGTH_MAX)
    expect(parsed?.radius).toBe(STYLE_LENGTH_MAX)
    expect(parsed?.borders).toEqual({
      top: STYLE_LENGTH_MAX,
      right: 0,
      bottom: STYLE_LENGTH_MAX,
      left: 40,
    })
  })

  it('parsePersistedStyle drops unknown registry ids (no portable blob)', () => {
    const parsed = parsePersistedStyle({
      schemaVersion: 1,
      style: {
        ...DEFAULT_STYLE,
        background: { color: '#fff', imageId: 'img_stale' },
      },
    })
    expect(parsed?.background.imageId).toBeNull()
  })

  it('persistFullStyle stores blob and clear removes LS + IDB', async () => {
    const style = structuredClone(DEFAULT_STYLE)
    style.spacing = 7
    style.background.imageId = 'img_bg'
    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' })
    const result = await persistFullStyle(style, async (id) => (id === 'img_bg' ? blob : null))
    expect(result.ok).toBe(true)
    expect(readPersistedStyle()?.spacing).toBe(7)
    expect(readPersistedStyle()?.background.imageId).toBe(STYLE_BG_MARKER)
    const loadedBlob = await loadPersistedBackgroundBlob()
    expect(loadedBlob).toBeTruthy()
    expect(loadedBlob!.size).toBe(blob.size)
    expect(loadedBlob!.type).toBe(blob.type)

    await clearPersistedStyleAndBackground()
    expect(localStorage.getItem(STYLE_STORAGE_KEY)).toBeNull()
    expect(await loadPersistedBackgroundBlob()).toBeNull()
  })

  it('persistFullStyle keeps color when blob resolve fails', async () => {
    const style = structuredClone(DEFAULT_STYLE)
    style.background.color = '#abcdef'
    style.background.imageId = 'img_missing'
    const result = await persistFullStyle(style, async () => null)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected persist failure')
    expect(result.styleJsonSaved).toBe(true)
    const loaded = readPersistedStyle()
    expect(loaded?.background.color).toBe('#abcdef')
    expect(loaded?.background.imageId).toBeNull()
    expect(await loadPersistedBackgroundBlob()).toBeNull()
  })
})

describe('useCollageStore style persistence', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:test'),
      revokeObjectURL: vi.fn(),
    })
    setActivePinia(createPinia())
    setStylePersistDebounceMsForTests(0)
    localStorage.clear()
    resetStyleBackgroundIdbForTests()
    useImageRegistry().reset()
  })

  afterEach(async () => {
    setStylePersistDebounceMsForTests(null)
    await Promise.resolve()
    await Promise.resolve()
    localStorage.clear()
    resetStyleBackgroundIdbForTests()
    useImageRegistry().reset()
    vi.unstubAllGlobals()
  })

  it('setStyle persists JSON; resetStyles clears persist', async () => {
    const store = useCollageStore()
    store.setStyle({ spacing: 55, downloadQuality: 'medium-jpg' })
    await store.flushStylePersistForTests()
    expect(readPersistedStyle()?.spacing).toBe(55)
    expect(readPersistedStyle()?.downloadQuality).toBe('medium-jpg')

    store.resetStyles()
    await new Promise((r) => setTimeout(r, 0))
    expect(store.style.spacing).toBe(DEFAULT_STYLE.spacing)
    expect(localStorage.getItem(STYLE_STORAGE_KEY)).toBeNull()
    expect(await loadPersistedBackgroundBlob()).toBeNull()
  })

  it('setStyle clamps watermark fontSize, rotation, density and aspect sides', async () => {
    const store = useCollageStore()
    store.setStyle({
      watermark: {
        ...store.style.watermark,
        fontSize: 500,
        rotation: 120,
        density: 9,
      },
      aspectRatio: { width: 20000, height: -3 },
    })
    expect(store.style.watermark.fontSize).toBe(WATERMARK_FONT_SIZE_MAX)
    expect(store.style.watermark.rotation).toBe(WATERMARK_ROTATION_MAX)
    expect(store.style.watermark.density).toBe(WATERMARK_DENSITY_MAX)
    expect(store.style.aspectRatio).toEqual({ width: ASPECT_SIDE_MAX, height: 1 })
    await store.flushStylePersistForTests()
    expect(readPersistedStyle()?.watermark.fontSize).toBe(WATERMARK_FONT_SIZE_MAX)
    expect(readPersistedStyle()?.aspectRatio.width).toBe(ASPECT_SIDE_MAX)
  })

  it('setStyle clamps spacing, radius, and borders to STYLE_LENGTH_MAX', async () => {
    const store = useCollageStore()
    store.setStyle({
      spacing: 999,
      radius: 81.2,
      borders: { top: 100, right: -1, bottom: 80, left: 12.6 },
    })
    expect(store.style.spacing).toBe(STYLE_LENGTH_MAX)
    expect(store.style.radius).toBe(STYLE_LENGTH_MAX)
    expect(store.style.borders).toEqual({
      top: STYLE_LENGTH_MAX,
      right: 0,
      bottom: STYLE_LENGTH_MAX,
      left: 13,
    })
    await store.flushStylePersistForTests()
    expect(readPersistedStyle()?.spacing).toBe(STYLE_LENGTH_MAX)
    expect(readPersistedStyle()?.borders.top).toBe(STYLE_LENGTH_MAX)
  })

  it('hydrate without IDB blob yields null imageId', async () => {
    writePersistedStyleJson({
      ...DEFAULT_STYLE,
      spacing: 18,
      background: { color: '#010203', imageId: 'img_x' },
    })
    // Marker is in LS but no IDB blob.
    expect(readPersistedStyle()?.background.imageId).toBe(STYLE_BG_MARKER)

    const store = useCollageStore()
    await store.hydrateStyleFromStorage()
    expect(store.style.spacing).toBe(18)
    expect(store.style.background.color).toBe('#010203')
    expect(store.style.background.imageId).toBeNull()
    // LS rewritten without marker
    expect(readPersistedStyle()?.background.imageId).toBeNull()
  })

  it('hydrate restores background blob into registry', async () => {
    const png = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' })
    await persistFullStyle(
      { ...DEFAULT_STYLE, background: { color: '#fff', imageId: 'img_tmp' } },
      async () => png,
    )
    expect(await loadPersistedBackgroundBlob()).toBeTruthy()
    expect(readPersistedStyle()?.background.imageId).toBe(STYLE_BG_MARKER)

    const registry = useImageRegistry()
    const addSpy = vi.spyOn(registry, 'addFile').mockImplementation(async (file: File) => {
      const entry = {
        id: 'img_hydrated_bg',
        name: file.name,
        objectUrl: 'blob:test-bg',
        bitmap: null,
        width: 8,
        height: 8,
        mimeType: file.type || 'image/png',
        derivedFromId: null,
        bakeTransform: null,
      }
      const next = new Map(registry.images)
      next.set(entry.id, entry)
      registry.images = next
      return entry
    })

    const store = useCollageStore()
    await store.hydrateStyleFromStorage()
    expect(addSpy).toHaveBeenCalled()
    expect(store.style.background.imageId).toBe('img_hydrated_bg')
    expect(registry.get('img_hydrated_bg')).toBeTruthy()
    addSpy.mockRestore()
  })
})

describe('clearPersistedStyleJson', () => {
  it('removes the fusion:style key', () => {
    writePersistedStyleJson(DEFAULT_STYLE)
    expect(localStorage.getItem(STYLE_STORAGE_KEY)).toBeTruthy()
    clearPersistedStyleJson()
    expect(localStorage.getItem(STYLE_STORAGE_KEY)).toBeNull()
  })
  it('parsePersistedStyle accepts #RGB and normalizes to #rrggbb', () => {
    const parsed = parsePersistedStyle({
      schemaVersion: 1,
      style: {
        ...DEFAULT_STYLE,
        background: { color: '#AbC', imageId: null },
      },
    })
    expect(parsed?.background.color).toBe('#aabbcc')
  })

  it('parsePersistedStyle accepts #RRGGBB case-insensitively', () => {
    const parsed = parsePersistedStyle({
      schemaVersion: 1,
      style: {
        ...DEFAULT_STYLE,
        background: { color: '#FfEeDd', imageId: null },
      },
    })
    expect(parsed?.background.color).toBe('#ffeedd')
  })

  it('parsePersistedStyle falls back to default for invalid or overlong bg color', () => {
    for (const color of ['red', '#gg0000', '#1234', '#1234567', 'transparent', '']) {
      const parsed = parsePersistedStyle({
        schemaVersion: 1,
        style: {
          ...DEFAULT_STYLE,
          background: { color, imageId: null },
        },
      })
      expect(parsed?.background.color).toBe(DEFAULT_STYLE.background.color)
    }
  })
})
