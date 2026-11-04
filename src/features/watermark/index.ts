export { drawWatermark } from './drawWatermark'
export { WATERMARK_FONT_FAMILY, watermarkCanvasFont } from './watermarkFont'
export {
  estimateTextSize,
  isTextAabbInside,
  measureWatermarkText,
  resolveWatermarkMode,
  resolveWatermarkPosition,
  rotatedTextHalfExtents,
  watermarkSingleAnchor,
  watermarkTileOffsets,
  watermarkTileSteps,
} from './watermarkLayout'
export type { TextMetrics, WatermarkPoint } from './watermarkLayout'
