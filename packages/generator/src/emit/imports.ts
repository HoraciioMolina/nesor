import { posix as pathPosix } from 'node:path'
import type { NesorConfig } from '../config.js'
import type { ResolvedField, ResolvedModel } from '../variants/resolver.js'

/** Canonical import source for the runtime Decimal type in Prisma 5/6. */
const DECIMAL_IMPORT_FROM = '@prisma/client/runtime/library'
const DECIMAL_RE = /\bDecimal\b/

/** Enum names referenced by any emitted field of `resolved` (default + variants). */
export function collectEnumImports(
  resolved: ResolvedModel,
  config: NesorConfig,
): readonly string[] {
  if (config.enumStrategy === 'inline') return []
  const names = new Set<string>()
  const visit = (fields: readonly ResolvedField[]): void => {
    for (const f of fields) {
      if (f.info.kind === 'enum' && f.enumName) names.add(f.enumName)
    }
  }
  visit(resolved.default)
  for (const v of resolved.variants) visit(v.fields)
  return [...names].sort()
}

function fieldsUseDecimal(fields: readonly ResolvedField[]): boolean {
  for (const f of fields) {
    if (f.info.kind === 'scalar' && DECIMAL_RE.test(f.tsType)) return true
  }
  return false
}

/** Whether any emitted field of the model references the Decimal runtime type. */
export function modelUsesDecimal(resolved: ResolvedModel, config: NesorConfig): boolean {
  if (config.decimalType !== 'Decimal') return false
  if (fieldsUseDecimal(resolved.default)) return true
  for (const v of resolved.variants) {
    if (fieldsUseDecimal(v.fields)) return true
  }
  return false
}

/** Whether any model in the set references the Decimal runtime type. */
export function anyModelUsesDecimal(
  resolved: readonly ResolvedModel[],
  config: NesorConfig,
): boolean {
  return resolved.some((r) => modelUsesDecimal(r, config))
}

function decimalImportLine(): string {
  return `import type { Decimal } from '${DECIMAL_IMPORT_FROM}'`
}

/** Compute the relative import specifier between two outputBase paths. */
export function computeRelativeImport(
  fromOutputBase: string,
  toOutputBase: string,
  ext: string,
): string {
  const fromDir = pathPosix.dirname(fromOutputBase)
  const relPath = pathPosix.relative(fromDir, toOutputBase)
  const withDotPrefix = relPath.startsWith('.') ? relPath : `./${relPath}`
  return `${withDotPrefix}${ext}`
}

function emitEnumImportLines(names: readonly string[], config: NesorConfig): string[] {
  if (names.length === 0) return []
  const list = names.join(', ')
  const lines = [`import type { ${list} } from '${config.enumImportFrom}'`]
  if (config.enumStrategy === 'reexport') {
    lines.push(`export type { ${list} } from '${config.enumImportFrom}'`)
  }
  return lines
}

/** Import block for a per-model file: enum imports + relation imports relative to that file. */
export function buildImportBlock(resolved: ResolvedModel, config: NesorConfig): string {
  const lines: string[] = [...emitEnumImportLines(collectEnumImports(resolved, config), config)]
  if (modelUsesDecimal(resolved, config)) lines.push(decimalImportLine())
  for (const [entityName, targetBase] of [...resolved.relationImports.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const importPath = computeRelativeImport(
      resolved.outputBase,
      targetBase,
      config.importExtension,
    )
    lines.push(`import type { ${entityName} } from '${importPath}'`)
  }
  return lines.join('\n')
}

/** Enum-only import block (no relation imports). Used by single-file mode. */
export function buildEnumOnlyImportBlock(names: readonly string[], config: NesorConfig): string {
  return emitEnumImportLines(names, config).join('\n')
}

/** Combined import block for single-file mode: enum imports + (optional) Decimal import. */
export function buildSingleFileImportBlock(
  enumNames: readonly string[],
  resolved: readonly ResolvedModel[],
  config: NesorConfig,
): string {
  const lines: string[] = [...emitEnumImportLines(enumNames, config)]
  if (anyModelUsesDecimal(resolved, config)) lines.push(decimalImportLine())
  return lines.join('\n')
}
