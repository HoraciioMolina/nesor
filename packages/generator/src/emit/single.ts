import type { NesorConfig } from '../config.js'
import type { WalkedSchema } from '../dmmf/walker.js'
import { type ResolvedField, type ResolvedModel, resolveModel } from '../variants/resolver.js'
import { makeBanner } from './banner.js'
import { emitBrandDeclsFor, emitInterface, jsdocFrom } from './declarations.js'
import { buildSingleFileImportBlock } from './imports.js'
import { buildMeta, emitMetaLiteral } from './meta.js'
import type { EmittedFile } from './types.js'

function collectEnumsAcross(resolved: readonly ResolvedModel[], config: NesorConfig): string[] {
  if (config.enumStrategy === 'inline') return []
  const names = new Set<string>()
  const visit = (fields: readonly ResolvedField[]): void => {
    for (const f of fields) {
      if (f.info.kind === 'enum' && f.enumName) names.add(f.enumName)
    }
  }
  for (const r of resolved) {
    visit(r.default)
    for (const v of r.variants) visit(v.fields)
  }
  return [...names].sort()
}

function collectBrandsAcross(resolved: readonly ResolvedModel[]): Map<string, string> {
  const out = new Map<string, string>()
  for (const r of resolved) {
    for (const b of r.brands) {
      if (!out.has(b.name)) out.set(b.name, b.baseType)
    }
  }
  return out
}

function emitModelBlock(resolved: ResolvedModel, config: NesorConfig): string {
  const entityName = `${resolved.entityBase}${config.entitySuffix}`
  const metaName = `${resolved.entityBase}${config.metaSuffix}`
  const parts: string[] = []
  const jsdoc = config.includeDocs ? jsdocFrom(resolved.description) : ''
  parts.push(`${jsdoc ? `${jsdoc}\n` : ''}${emitInterface(entityName, resolved.default)}`)
  for (const v of resolved.variants) {
    const vname = `${resolved.entityBase}${config.variantSeparator}${v.name}${config.entitySuffix}`
    if (v.extendsDefault) parts.push(emitInterface(vname, v.extras, entityName))
    else parts.push(emitInterface(vname, v.fields))
  }
  if (config.emitMeta) {
    parts.push(
      `export const ${metaName} = ${emitMetaLiteral(buildMeta(resolved, config))} as const`,
    )
  }
  return parts.join('\n\n')
}

/** Emit every model in the schema into one combined file. */
export function emitSingleFile(schema: WalkedSchema, config: NesorConfig): EmittedFile | null {
  const resolved: ResolvedModel[] = []
  for (const m of schema.models) {
    const r = resolveModel(m, schema, config)
    if (r) resolved.push(r)
  }
  if (resolved.length === 0) return null

  const parts: string[] = []
  const banner = makeBanner('all models', config.banner)
  if (banner) parts.push(banner)

  const imports = buildSingleFileImportBlock(collectEnumsAcross(resolved, config), resolved, config)
  if (imports) parts.push(imports)

  const brands = emitBrandDeclsFor(collectBrandsAcross(resolved))
  if (brands) parts.push(brands)

  for (const r of resolved) parts.push(emitModelBlock(r, config))

  return { path: `entities${config.fileNameSuffix}.ts`, text: `${parts.join('\n\n')}\n` }
}
