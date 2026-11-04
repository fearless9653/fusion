/**
 * Shared watermark typeface for DOM preview and Canvas export.
 * Same string on both paths so one device matches preview ↔ download.
 * Stack: system-ui first for cross-engine parity, then Apple/UI Latin, CJK, sans-serif.
 */
export const WATERMARK_FONT_FAMILY =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", "Noto Sans CJK SC", "WenQuanYi Micro Hei", sans-serif'

/** Canvas `ctx.font` / CSS font shorthand size + family. */
export function watermarkCanvasFont(fontSize: number): string {
  return `${Math.max(8, fontSize)}px ${WATERMARK_FONT_FAMILY}`
}
