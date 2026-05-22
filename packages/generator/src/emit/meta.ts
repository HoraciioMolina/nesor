import type { NesorConfig } from '../config.js'
import type { EntityMeta, FieldInfo, VariantInfo } from '../types.js'
import { quote } from '../util/quote.js'
import type { ResolvedModel } from '../variants/resolver.js'

function emitFieldInfoLiteral(info: FieldInfo): string {
  const parts: string[] = [
    `source: ${quote(info.source)}`,
    `kind: ${quote(info.kind)}`,
    `tsType: ${quote(info.tsType)}`,
  ]
  if (info.nullable) parts.push('nullable: true')
  if (info.list) parts.push('list: true')
  if (info.readonly) parts.push('readonly: true')
  if (info.brand) parts.push(`brand: ${quote(info.brand)}`)
  if (info.renamedFrom) parts.push(`renamedFrom: ${quote(info.renamedFrom)}`)
  return `{ ${parts.join(', ')} }`
}

/** Pretty-print an EntityMeta as a TS object literal (without the surrounding `as const`). */
export function emitMetaLiteral(meta: EntityMeta): string {
  const fieldEntries = Object.entries(meta.fields)
    .map(([k, v]) => `    ${k}: ${emitFieldInfoLiteral(v)},`)
    .join('\n')
  const excluded = meta.excluded.map(quote).join(', ')
  const secrets = meta.secrets.map(quote).join(', ')
  const variants = Object.entries(meta.variants)
    .map(([k, v]) => {
      const inner: string[] = []
      if (v.include) inner.push(`include: [${v.include.map(quote).join(', ')}]`)
      if (v.exclude) inner.push(`exclude: [${v.exclude.map(quote).join(', ')}]`)
      if (v.withRelations) inner.push(`withRelations: [${v.withRelations.map(quote).join(', ')}]`)
      return `    ${k}: { ${inner.join(', ')} },`
    })
    .join('\n')
  const variantBlock = variants ? `\n${variants}\n  ` : ''
  return [
    '{',
    `  prismaModel: ${quote(meta.prismaModel)},`,
    `  entityName: ${quote(meta.entityName)},`,
    '  fields: {',
    fieldEntries,
    '  },',
    `  excluded: [${excluded}],`,
    `  secrets: [${secrets}],`,
    `  variants: {${variantBlock}},`,
    '}',
  ].join('\n')
}

/** Build the EntityMeta value from a ResolvedModel + config. */
export function buildMeta(resolved: ResolvedModel, config: NesorConfig): EntityMeta {
  const entityName = `${resolved.entityBase}${config.entitySuffix}`
  const fields = Object.fromEntries(resolved.default.map((f) => [f.outName, f.info]))
  const variants: Record<string, VariantInfo> = {}
  for (const v of resolved.variants) variants[v.name] = v.meta
  return {
    prismaModel: resolved.modelName,
    entityName,
    fields,
    excluded: config.metaIncludeExcluded ? resolved.excluded : [],
    secrets: resolved.secrets,
    variants,
  }
}
