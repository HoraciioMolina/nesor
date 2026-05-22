/**
 * Emit a TS string literal preferring single quotes; switch to double quotes when the value contains
 * a single quote so the output stays formatter-friendly (no escaped apostrophes).
 */
export function quote(s: string): string {
  if (!s.includes("'")) return `'${s.replace(/\\/g, '\\\\')}'`
  if (!s.includes('"')) return `"${s.replace(/\\/g, '\\\\')}"`
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}
