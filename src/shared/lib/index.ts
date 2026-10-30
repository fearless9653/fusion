/** Shared pure helpers. */
export {
  IMAGE_FILE_MAX_BYTES,
  IMAGE_MAX_EDGE_PX,
  LAYOUT_JSON_MAX_BYTES,
  isLayoutJsonOversize,
  utf8ByteLength,
} from './boundaryLimits'
export { fitAspectRect } from './fitAspectRect'
export {
  DEFAULT_MIN_FRACTION,
  cellRectFromFractions,
  fractionsToCssTemplate,
  normalizeFractions,
  redistributeAdjacent,
  trackPixelSizes,
} from './trackFractions'

export { measureSharedGutterSegments, type GutterOverlaySegment } from './gutterSegments'
