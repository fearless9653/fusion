import type { LayoutDefinition } from './types'
import { CORE_TEMPLATES } from './templatesCore'

const registry = new Map<string, LayoutDefinition>(
  CORE_TEMPLATES.map((tpl) => [tpl.id, structuredClone(tpl)]),
)

let catalogLoaded = false
let catalogLoading: Promise<void> | null = null

/** Register or replace a built-in / runtime template by id. */
export function registerTemplate(template: LayoutDefinition): void {
  registry.set(template.id, structuredClone(template))
}

/** List all currently registered templates (cloned). Core until catalog loads. */
export function listTemplates(): LayoutDefinition[] {
  return Array.from(registry.values()).map((tpl) => structuredClone(tpl))
}

/** Lookup one template by id (cloned), or undefined. */
export function getTemplate(id: string): LayoutDefinition | undefined {
  const found = registry.get(id)
  return found ? structuredClone(found) : undefined
}

/** Whether the full catalog chunk has been merged into the registry. */
export function isTemplateCatalogLoaded(): boolean {
  return catalogLoaded
}

/**
 * Lazily load the remaining built-in layouts into the registry.
 * Safe to call repeatedly; concurrent callers share one promise.
 */
export async function ensureTemplateCatalog(): Promise<void> {
  if (catalogLoaded) return
  if (!catalogLoading) {
    catalogLoading = import('./templatesCatalog')
      .then((m) => {
        for (const tpl of m.CATALOG_TEMPLATES) {
          registry.set(tpl.id, structuredClone(tpl))
        }
        catalogLoaded = true
      })
      .catch((err) => {
        catalogLoading = null
        throw err
      })
  }
  await catalogLoading
}

/** Reset registry to shipped core only (tests / hot reload). */
export function resetBuiltinTemplates(): void {
  catalogLoaded = false
  catalogLoading = null
  registry.clear()
  for (const tpl of CORE_TEMPLATES) {
    registry.set(tpl.id, structuredClone(tpl))
  }
}
