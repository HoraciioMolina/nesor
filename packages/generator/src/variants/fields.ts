import type { NesorConfig } from '../config.js'
import type { WalkedEnum, WalkedField, WalkedModel } from '../dmmf/walker.js'
import { enumToTs, scalarToTs, wrapType } from '../emit/scalars.js'
import type { FieldInfo } from '../types.js'
import { NesorError } from '../util/diagnostics.js'
import { computeOutputBase, entityBaseOf } from './identity.js'
import type { ResolvedField } from './types.js'

/** Whether a field is excluded (and whether it is also marked secret) by DSL. */
export function isExcludedByDsl(f: WalkedField): { excluded: boolean; secret: boolean } {
  let excluded = false
  let secret = false
  for (const t of f.docs.tags) {
    if (t.kind === 'exclude') excluded = true
    if (t.kind === 'secret') {
      excluded = true
      secret = true
    }
  }
  return { excluded, secret }
}

interface ScalarBase {
  tsType: string
  decimalAdvisory: boolean
  brand?: string
}

function resolveScalarOrEnum(
  f: WalkedField,
  enumsByName: ReadonlyMap<string, WalkedEnum>,
  config: NesorConfig,
): ScalarBase {
  let baseType: string
  if (f.kind === 'enum') baseType = enumToTs(f.type, enumsByName, config)
  else baseType = scalarToTs(f.type, config)

  const brandTag = f.docs.tags.find((t) => t.kind === 'brand')
  let brand: string | undefined
  if (brandTag?.kind === 'brand') {
    brand = brandTag.name
    baseType = brand
  }

  const tsType = wrapType(baseType, f)
  const decimalAdvisory =
    f.kind === 'scalar' && f.type === 'Decimal' && config.decimalType === 'string' && !brand
  return brand !== undefined ? { tsType, decimalAdvisory, brand } : { tsType, decimalAdvisory }
}

/** Resolve a scalar or enum field into a ResolvedField. */
export function resolveScalarField(
  f: WalkedField,
  enumsByName: ReadonlyMap<string, WalkedEnum>,
  config: NesorConfig,
): ResolvedField {
  const renameTag = f.docs.tags.find((t) => t.kind === 'rename')
  const outName = renameTag?.kind === 'rename' ? renameTag.to : f.name
  const { tsType, decimalAdvisory, brand } = resolveScalarOrEnum(f, enumsByName, config)

  const info: FieldInfo = {
    source: f.name,
    kind: f.kind === 'enum' ? 'enum' : 'scalar',
    tsType,
  }
  if (!f.isRequired && !f.isList) info.nullable = true
  if (f.isList) info.list = true
  if (brand) info.brand = brand
  if (renameTag?.kind === 'rename') info.renamedFrom = f.name

  const base: ResolvedField = {
    outName,
    source: f.name,
    tsType,
    tsOptional: false,
    decimalAdvisory,
    info,
    isRelation: false,
  }
  if (f.kind === 'enum') base.enumName = f.type
  return base
}

/** Resolve a relation (kind === 'object') field. forcedRequired strips the trailing `| null`. */
export function resolveRelationField(
  f: WalkedField,
  modelsByName: ReadonlyMap<string, WalkedModel>,
  config: NesorConfig,
  forcedRequired = false,
): ResolvedField {
  const related = modelsByName.get(f.type)
  if (!related) {
    throw new NesorError(
      `Relation field references unknown model "${f.type}" (target of ${f.name}).`,
    )
  }
  const relatedBase = entityBaseOf(related)
  const relatedEntityName = `${relatedBase}${config.entitySuffix}`
  const relatedFileBase = computeOutputBase(related, config)

  let tsType: string
  if (f.isList) {
    tsType = `${relatedEntityName}[]`
  } else if (f.isRequired || forcedRequired) {
    tsType = relatedEntityName
  } else {
    tsType = `${relatedEntityName} | null`
  }

  const info: FieldInfo = { source: f.name, kind: 'relation', tsType }
  if (!f.isRequired && !f.isList) info.nullable = true
  if (f.isList) info.list = true

  return {
    outName: f.name,
    source: f.name,
    tsType,
    tsOptional: false,
    decimalAdvisory: false,
    info,
    isRelation: true,
    relatedEntityName,
    relatedFileBase,
  }
}
