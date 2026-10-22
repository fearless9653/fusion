/** Normalize pasted / edited LayoutDefinition JSON text before parse. */
export function normalizeLayoutJsonText(input: string): string {
  let s = input.replace(/^\uFEFF/, '').trim()
  if (!s) return ''
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(s)
  if (fence?.[1]) s = fence[1].trim()
  return s
}
