import type { NesorConfig } from '../config.js'
import type { WalkedEnum, WalkedField } from '../dmmf/walker.js'
import { NesorError } from '../util/diagnostics.js'

const SCALAR_BASE: Readonly<Record<string, string>> = {
  String: 'string',
  Int: 'number',
  Float: 'number',
  Boolean: 'boolean',
}

/** Resolve a scalar Prisma type to a base TS type (no list/nullable wrapping). */
export function scalarToTs(prismaType: string, config: NesorConfig): string {
  const base = SCALAR_BASE[prismaType]
  if (base) return base
  switch (prismaType) {
    case 'DateTime':
      return config.dateType
    case 'BigInt':
      return config.bigIntType
    case 'Decimal':
      return config.decimalType
    case 'Json':
      return config.jsonType
    case 'Bytes':
      return config.bytesType
    default:
      throw new NesorError(`Unsupported Prisma scalar "${prismaType}".`)
  }
}

/** Resolve an enum reference based on the configured strategy. */
export function enumToTs(
  enumName: string,
  enumsByName: ReadonlyMap<string, WalkedEnum>,
  config: NesorConfig,
): string {
  const e = enumsByName.get(enumName)
  if (!e) throw new NesorError(`Reference to unknown enum "${enumName}".`)
  if (config.enumStrategy === 'inline') {
    if (e.values.length === 0) return 'never'
    return e.values.map((v) => `'${v}'`).join(' | ')
  }
  return enumName
}

/** Wrap a base TS type with list / nullable modifiers based on the field. */
export function wrapType(baseType: string, field: WalkedField): string {
  if (field.isList) return `${baseType}[]`
  if (!field.isRequired) return `${baseType} | null`
  return baseType
}
