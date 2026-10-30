/** Persist CollageStyle to localStorage; background binary lives in IndexedDB. */

import type {
  AspectSource,
  BorderWidths,
  CollageStyle,
  DownloadQuality,
  WatermarkMode,
  WatermarkPosition,
  WatermarkStyle,
} from '@/entities/session'
import { DEFAULT_STYLE } from '@/entities/session'
import {
  deleteStyleBackgroundBlob,
  getStyleBackgroundBlob,
  putStyleBackgroundBlob,
} from './styleBackgroundIdb'

export const STYLE_STORAGE_KEY = 'fusion:style'

/**
 * Stable marker stored in LS `background.imageId` instead of ephemeral registry ids.
 * On hydrate, IDB blob → registry → real memory imageId.
 */
export const STYLE_BG_MARKER = 'idb:background'

export type PersistedStylePayload = {
  schemaVersion: 1
  style: CollageStyle
}

export type PersistStyleResult =
  { ok: true } | { ok: false; reason: 'quota' | 'unknown'; styleJsonSaved: boolean }

/** JSON clone — session style may be a Vue reactive proxy (structuredClone fails). */
function cloneStyle(style: CollageStyle): CollageStyle {
  return JSON.parse(JSON.stringify(style)) as CollageStyle
}

function isQuotaError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { name?: string; code?: number }
  return e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22
}

/** Clone style for LS: remap any real imageId to the stable IDB marker. */
export function styleForStorage(style: CollageStyle): CollageStyle {
  const next = cloneStyle(style)
  if (next.background.imageId) {
    next.background.imageId = STYLE_BG_MARKER
  } else {
    next.background.imageId = null
  }
  return next
}

function asFiniteNumber(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function parseBorders(raw: unknown, fallback: BorderWidths): BorderWidths {
  if (!raw || typeof raw !== 'object') return { ...fallback }
  const o = raw as Record<string, unknown>
  return {
    top: Math.max(0, asFiniteNumber(o.top, fallback.top)),
    right: Math.max(0, asFiniteNumber(o.right, fallback.right)),
    bottom: Math.max(0, asFiniteNumber(o.bottom, fallback.bottom)),
    left: Math.max(0, asFiniteNumber(o.left, fallback.left)),
  }
}

function parseWatermark(raw: unknown, fallback: WatermarkStyle): WatermarkStyle {
  if (!raw || typeof raw !== 'object') return structuredClone(fallback)
  const o = raw as Record<string, unknown>
  const mode: WatermarkMode = o.mode === 'single' ? 'single' : 'tile'
  const positions: WatermarkPosition[] = [
    'center',
    'top-left',
    'top-right',
    'bottom-left',
    'bottom-right',
  ]
  const position: WatermarkPosition = positions.includes(o.position as WatermarkPosition)
    ? (o.position as WatermarkPosition)
    : fallback.position
  return {
    enabled: Boolean(o.enabled),
    text: typeof o.text === 'string' ? o.text : fallback.text,
    fontSize: Math.max(1, asFiniteNumber(o.fontSize, fallback.fontSize)),
    opacity: Math.min(1, Math.max(0, asFiniteNumber(o.opacity, fallback.opacity))),
    rotation: asFiniteNumber(o.rotation, fallback.rotation),
    density: Math.max(1, asFiniteNumber(o.density, fallback.density)),
    mode,
    position,
  }
}

function parseDownloadQuality(raw: unknown): DownloadQuality {
  if (raw === 'high-jpg' || raw === 'medium-jpg' || raw === 'png') return raw
  return DEFAULT_STYLE.downloadQuality
}

function parseAspectSource(raw: unknown): AspectSource {
  if (raw === 'common' || raw === 'print' || raw === 'custom') return raw
  return DEFAULT_STYLE.aspectSource
}

/** Validate / coerce unknown JSON into CollageStyle, or null if unusable. */
export function parsePersistedStyle(raw: unknown): CollageStyle | null {
  if (!raw || typeof raw !== 'object') return null
  const root = raw as Record<string, unknown>
  const styleRaw =
    root.schemaVersion === 1 && root.style && typeof root.style === 'object'
      ? (root.style as Record<string, unknown>)
      : root.aspectRatio
        ? root
        : null
  if (!styleRaw) return null

  const aspectRaw = styleRaw.aspectRatio
  if (!aspectRaw || typeof aspectRaw !== 'object') return null
  const ar = aspectRaw as Record<string, unknown>
  const width = asFiniteNumber(ar.width, NaN)
  const height = asFiniteNumber(ar.height, NaN)
  if (!(width > 0) || !(height > 0)) return null

  const bgRaw =
    styleRaw.background && typeof styleRaw.background === 'object'
      ? (styleRaw.background as Record<string, unknown>)
      : null
  const color =
    bgRaw && typeof bgRaw.color === 'string' && bgRaw.color
      ? bgRaw.color
      : DEFAULT_STYLE.background.color
  const imageIdRaw = bgRaw?.imageId
  const imageId =
    imageIdRaw === STYLE_BG_MARKER
      ? STYLE_BG_MARKER
      : imageIdRaw === null || imageIdRaw === undefined || imageIdRaw === ''
        ? null
        : // Legacy / accidental registry ids are not portable — treat as "has blob marker"
          // only when equal to marker; otherwise drop (hydrate without image).
          null

  const aspectSource = parseAspectSource(styleRaw.aspectSource)
  const printSizeId =
    aspectSource === 'print' && typeof styleRaw.printSizeId === 'string'
      ? styleRaw.printSizeId
      : null
  const commonAspectId =
    aspectSource === 'common' && typeof styleRaw.commonAspectId === 'string'
      ? styleRaw.commonAspectId
      : aspectSource === 'common'
        ? DEFAULT_STYLE.commonAspectId
        : null

  return {
    aspectRatio: { width, height },
    printSizeId,
    commonAspectId,
    aspectSource,
    spacing: Math.max(0, asFiniteNumber(styleRaw.spacing, DEFAULT_STYLE.spacing)),
    radius: Math.max(0, asFiniteNumber(styleRaw.radius, DEFAULT_STYLE.radius)),
    borders: parseBorders(styleRaw.borders, DEFAULT_STYLE.borders),
    background: { color, imageId },
    watermark: parseWatermark(styleRaw.watermark, DEFAULT_STYLE.watermark),
    downloadQuality: parseDownloadQuality(styleRaw.downloadQuality),
  }
}

export function readPersistedStyle(): CollageStyle | null {
  try {
    const raw = localStorage.getItem(STYLE_STORAGE_KEY)
    if (raw === null) return null
    return parsePersistedStyle(JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

/** Write style JSON only (imageId remapped to marker). */
export function writePersistedStyleJson(style: CollageStyle): PersistStyleResult {
  const payload: PersistedStylePayload = {
    schemaVersion: 1,
    style: styleForStorage(style),
  }
  try {
    localStorage.setItem(STYLE_STORAGE_KEY, JSON.stringify(payload))
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: isQuotaError(err) ? 'quota' : 'unknown', styleJsonSaved: false }
  }
}

export function clearPersistedStyleJson(): void {
  try {
    localStorage.removeItem(STYLE_STORAGE_KEY)
  } catch {
    // ignore
  }
}

/**
 * Persist full style: LS JSON always attempted; IDB blob put/delete for background.
 * On IDB failure, still keeps color/rest in LS with imageId null when possible.
 */
export async function persistFullStyle(
  style: CollageStyle,
  resolveBlob: (imageId: string) => Promise<Blob | null>,
): Promise<PersistStyleResult> {
  const imageId = style.background.imageId

  if (!imageId) {
    const jsonResult = writePersistedStyleJson(style)
    try {
      await deleteStyleBackgroundBlob()
    } catch (err) {
      if (!jsonResult.ok) {
        return {
          ok: false,
          reason: isQuotaError(err) ? 'quota' : jsonResult.reason,
          styleJsonSaved: false,
        }
      }
      return {
        ok: false,
        reason: isQuotaError(err) ? 'quota' : 'unknown',
        styleJsonSaved: true,
      }
    }
    return jsonResult
  }

  let blob: Blob | null = null
  try {
    blob = await resolveBlob(imageId)
  } catch {
    blob = null
  }

  if (!blob) {
    // Cannot resolve binary — persist color/rest without image marker.
    const withoutImage: CollageStyle = {
      ...cloneStyle(style),
      background: { ...cloneStyle(style).background, imageId: null },
    }
    const jsonResult = writePersistedStyleJson(withoutImage)
    try {
      await deleteStyleBackgroundBlob()
    } catch {
      // ignore secondary failure
    }
    if (!jsonResult.ok) return jsonResult
    return { ok: false, reason: 'unknown', styleJsonSaved: true }
  }

  try {
    await putStyleBackgroundBlob(blob)
  } catch (err) {
    const withoutImage: CollageStyle = {
      ...cloneStyle(style),
      background: { ...cloneStyle(style).background, imageId: null },
    }
    const jsonResult = writePersistedStyleJson(withoutImage)
    return {
      ok: false,
      reason: isQuotaError(err) ? 'quota' : 'unknown',
      styleJsonSaved: jsonResult.ok,
    }
  }

  const jsonResult = writePersistedStyleJson(style)
  if (!jsonResult.ok) {
    return { ok: false, reason: jsonResult.reason, styleJsonSaved: false }
  }
  return { ok: true }
}

/** Clear LS style key + IDB background blob (reset / explicit clear). */
export async function clearPersistedStyleAndBackground(): Promise<void> {
  clearPersistedStyleJson()
  await deleteStyleBackgroundBlob()
}

export async function loadPersistedBackgroundBlob(): Promise<Blob | null> {
  try {
    return await getStyleBackgroundBlob()
  } catch {
    return null
  }
}

export { getStyleBackgroundBlob, deleteStyleBackgroundBlob, putStyleBackgroundBlob }
