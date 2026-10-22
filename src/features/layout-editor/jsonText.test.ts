import { describe, expect, it } from 'vitest'
import { normalizeLayoutJsonText } from './jsonText'

describe('normalizeLayoutJsonText', () => {
  it('trims BOM and whitespace', () => {
    expect(normalizeLayoutJsonText('\uFEFF {"a":1} \n')).toBe('{"a":1}')
  })

  it('strips markdown json fences', () => {
    const inner = '{\n  "schemaVersion": 1\n}'
    expect(normalizeLayoutJsonText('```json\n' + inner + '\n```')).toBe(inner)
  })

  it('returns empty for whitespace-only', () => {
    expect(normalizeLayoutJsonText('  \n\t ')).toBe('')
  })
})
