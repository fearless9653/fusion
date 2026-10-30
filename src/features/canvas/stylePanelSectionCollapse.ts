/** Persist StylePanel section open flags (aspect / style / watermark). */

import { readBoolFlag, writeBoolFlag } from '@/shared/utils'

export const STYLE_PANEL_ASPECT_OPEN_KEY = 'fusion:style-panel-aspect-open'
export const STYLE_PANEL_STYLE_OPEN_KEY = 'fusion:style-panel-style-open'
export const STYLE_PANEL_WATERMARK_OPEN_KEY = 'fusion:style-panel-watermark-open'

export function readStylePanelSectionOpen(key: string, fallback = true): boolean {
  return readBoolFlag(key, fallback)
}

export function writeStylePanelSectionOpen(key: string, open: boolean): void {
  writeBoolFlag(key, open)
}
