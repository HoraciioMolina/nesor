/** Per-field metadata emitted into the EntityMeta const. */
export interface FieldInfo {
  /** Name of the field on the Prisma row (the source side). */
  source: string
  kind: 'scalar' | 'enum' | 'relation'
  /** TS type string as emitted in the interface. */
  tsType: string
  nullable?: true
  list?: true
  brand?: string
  readonly?: true
  /** Set if the entity field name differs from `source` (i.e. @nesor-rename was used). */
  renamedFrom?: string
}

/** Per-variant inclusion / exclusion rules. */
export interface VariantInfo {
  include?: readonly string[]
  exclude?: readonly string[]
  withRelations?: readonly string[]
}

/** Static, inert metadata describing one generated entity. */
export interface EntityMeta {
  prismaModel: string
  entityName: string
  fields: Readonly<Record<string, FieldInfo>>
  excluded: readonly string[]
  secrets: readonly string[]
  variants: Readonly<Record<string, VariantInfo>>
}
