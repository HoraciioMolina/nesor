import type { FieldInfo, VariantInfo } from '../types.js'

/** A field after resolving DSL tags and the chosen TS type. */
export interface ResolvedField {
  outName: string
  source: string
  tsType: string
  /** Emit as `name?:` rather than `name:`. */
  tsOptional: boolean
  decimalAdvisory: boolean
  info: FieldInfo
  isRelation: boolean
  relatedEntityName?: string
  relatedFileBase?: string
  /** When info.kind === 'enum', the Prisma enum's name (used for imports). */
  enumName?: string
}

/** A variant after combining its declaration with default-field state. */
export interface ResolvedVariant {
  name: string
  fields: ResolvedField[]
  /** True: emit as `interface XV extends X { extras }`. */
  extendsDefault: boolean
  extras: ResolvedField[]
  meta: VariantInfo
}

/** A model fully resolved into the data the emitter needs. */
export interface ResolvedModel {
  modelName: string
  entityBase: string
  fileBase: string
  /** Relative path from output root, excluding the .ts extension. e.g. 'billing/invoice.entity'. */
  outputBase: string
  description: string
  default: ResolvedField[]
  excluded: string[]
  secrets: string[]
  variants: ResolvedVariant[]
  /** entity name -> the target model's outputBase (from output root). */
  relationImports: Map<string, string>
  /** Branded type declarations to emit at the top of the file. */
  brands: { name: string; baseType: string }[]
}

/** A declared @nesor-variant projected for resolver use (keeps `docLine` for diagnostics). */
export interface VariantDecl {
  name: string
  include?: readonly string[]
  exclude?: readonly string[]
  withRelations?: readonly string[]
  /** 1-based line within the model's doc-comment block where the variant was declared. */
  docLine: number
}
