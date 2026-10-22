import type { LayoutDefinition } from './types'
import { layoutDefinitionSchema, safeParseLayoutDefinition } from './schema'

/**
 * Validate unknown input as LayoutDefinition v1.
 * Throws ZodError on failure (same as parseLayoutDefinition).
 */
export function validateLayout(input: unknown): LayoutDefinition {
  return layoutDefinitionSchema.parse(input) as LayoutDefinition
}

/** Non-throwing validate — returns success flag + data or error. */
export function tryValidateLayout(input: unknown) {
  return safeParseLayoutDefinition(input)
}
