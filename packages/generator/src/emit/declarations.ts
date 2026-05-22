import { quote } from '../util/quote.js'
import type { ResolvedField, ResolvedModel } from '../variants/resolver.js'

/** Build a JSDoc comment from a free-text description, or '' when empty. */
export function jsdocFrom(description: string): string {
  const lines = description
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  if (lines.length === 0) return ''
  if (lines.length === 1) return `/** ${lines[0]} */`
  return ['/**', ...lines.map((l) => ` * ${l}`), ' */'].join('\n')
}

/** Emit an `export interface` block. Honours `tsOptional` and the decimal-as-string advisory. */
export function emitInterface(
  name: string,
  fields: readonly ResolvedField[],
  extendsName?: string,
): string {
  const lines: string[] = []
  const header = extendsName
    ? `export interface ${name} extends ${extendsName} {`
    : `export interface ${name} {`
  lines.push(header)
  for (const f of fields) {
    if (f.decimalAdvisory) {
      lines.push(
        '  /** Decimal as string. Parse with a Decimal library before doing arithmetic. */',
      )
    }
    const opt = f.tsOptional ? '?' : ''
    lines.push(`  ${f.outName}${opt}: ${f.tsType}`)
  }
  lines.push('}')
  return lines.join('\n')
}

/** Emit `export type` declarations for each brand on a single model. */
export function emitBrandDecls(resolved: ResolvedModel): string {
  if (resolved.brands.length === 0) return ''
  return resolved.brands
    .map((b) => `export type ${b.name} = ${b.baseType} & { readonly __brand: ${quote(b.name)} }`)
    .join('\n')
}

/** Emit `export type` declarations for an arbitrary brand set, deduped. */
export function emitBrandDeclsFor(brands: ReadonlyMap<string, string>): string {
  if (brands.size === 0) return ''
  return [...brands.entries()]
    .map(([name, base]) => `export type ${name} = ${base} & { readonly __brand: ${quote(name)} }`)
    .join('\n')
}
