import type { NesorConfig } from '../config.js'
import type { WalkedModel, WalkedSchema } from '../dmmf/walker.js'
import { resolveModel } from '../variants/resolver.js'
import { makeBanner } from './banner.js'
import { emitBrandDecls, emitInterface, jsdocFrom } from './declarations.js'
import { buildImportBlock } from './imports.js'
import { buildMeta, emitMetaLiteral } from './meta.js'
import type { EmittedFile } from './types.js'

export type { EmittedFile } from './types.js'

/** Emit a single model into a TS source file (text + relative path). */
export function emitModelFile(
  model: WalkedModel,
  schema: WalkedSchema,
  config: NesorConfig,
): EmittedFile | null {
  const resolved = resolveModel(model, schema, config)
  if (!resolved) return null

  const entityName = `${resolved.entityBase}${config.entitySuffix}`
  const metaName = `${resolved.entityBase}${config.metaSuffix}`

  const parts: string[] = []
  const banner = makeBanner(`model ${model.name}`, config.banner)
  if (banner) parts.push(banner)

  const imports = buildImportBlock(resolved, config)
  if (imports) parts.push(imports)

  const brands = emitBrandDecls(resolved)
  if (brands) parts.push(brands)

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

  return { path: `${resolved.outputBase}.ts`, text: `${parts.join('\n\n')}\n` }
}
