export type { LayoutCell, LayoutDefinition, LayoutGrid } from './types'
export {
  isFullCoverage,
  layoutDefinitionSchema,
  parseLayoutDefinition,
  safeParseLayoutDefinition,
} from './schema'
export type { LayoutDefinitionParsed } from './schema'
export {
  addCell,
  autoFillEmptyCells,
  cellArea,
  cellsOverlap,
  createEmptyGridCells,
  createUnitGridCells,
  inBounds,
  isFullCoverage as isFullCoveragePure,
  moveCell,
  overlapsAny,
  removeCell,
  resizeCell,
  totalCoverage,
  withSyncedImageCount,
} from './ops'
export type { LayoutOpFailure, LayoutOpResult, LayoutOpSuccess } from './ops'
export {
  ensureTemplateCatalog,
  getTemplate,
  isTemplateCatalogLoaded,
  listTemplates,
  registerTemplate,
  resetBuiltinTemplates,
} from './templates'
export { tryValidateLayout, validateLayout } from './validate'
