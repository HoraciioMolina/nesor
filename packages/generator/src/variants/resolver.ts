import type { NesorConfig } from '../config.js'
import type { WalkedEnum, WalkedField, WalkedModel, WalkedSchema } from '../dmmf/walker.js'
import { enumToTs, scalarToTs } from '../emit/scalars.js'
import { NesorError } from '../util/diagnostics.js'
import { toFileBaseName } from '../util/naming.js'
import { isExcludedByDsl, resolveRelationField, resolveScalarField } from './fields.js'
import { computeOutputBase, entityBaseOf } from './identity.js'
import type { ResolvedField, ResolvedModel, ResolvedVariant, VariantDecl } from './types.js'
import { declaredVariants, validateVariantReferences, variantsTargetedBy } from './validate.js'

export { computeOutputBase } from './identity.js'
export type { ResolvedField, ResolvedModel, ResolvedVariant } from './types.js'

interface FieldsState {
  excluded: string[]
  secrets: string[]
  defaultList: ResolvedField[]
  allResolved: Map<string, ResolvedField>
  relationResolved: Map<string, ResolvedField>
  relationImports: Map<string, string>
  brands: { name: string; baseType: string }[]
  dropsByVariant: Map<string, Set<string>>
  forcedByVariant: Map<string, Set<string>>
}

function newFieldsState(): FieldsState {
  return {
    excluded: [],
    secrets: [],
    defaultList: [],
    allResolved: new Map(),
    relationResolved: new Map(),
    relationImports: new Map(),
    brands: [],
    dropsByVariant: new Map(),
    forcedByVariant: new Map(),
  }
}

function recordVariantOverrides(
  field: { name: string },
  state: FieldsState,
  excludeFrom: readonly string[],
  includeIn: readonly string[],
): void {
  for (const v of excludeFrom) {
    if (!state.dropsByVariant.has(v)) state.dropsByVariant.set(v, new Set())
    state.dropsByVariant.get(v)?.add(field.name)
  }
  for (const v of includeIn) {
    if (!state.forcedByVariant.has(v)) state.forcedByVariant.set(v, new Set())
    state.forcedByVariant.get(v)?.add(field.name)
  }
}

function processField(
  field: WalkedField,
  modelName: string,
  state: FieldsState,
  enumsByName: ReadonlyMap<string, WalkedEnum>,
  modelsByName: ReadonlyMap<string, WalkedModel>,
  config: NesorConfig,
): void {
  const { excluded: isExcluded, secret: isSecret } = isExcludedByDsl(field)
  if (isSecret) state.secrets.push(field.name)
  if (isExcluded) state.excluded.push(field.name)

  recordVariantOverrides(
    field,
    state,
    variantsTargetedBy(field, 'exclude-from'),
    variantsTargetedBy(field, 'include-in'),
  )

  if (field.kind === 'object') {
    const rf = resolveRelationField(field, modelsByName, config)
    state.relationResolved.set(field.name, rf)
    if (isExcluded) return
    if (config.includeRelations === 'optional') {
      state.defaultList.push({ ...rf, tsOptional: true })
      if (rf.relatedEntityName && rf.relatedFileBase)
        state.relationImports.set(rf.relatedEntityName, rf.relatedFileBase)
    } else if (config.includeRelations === 'required') {
      state.defaultList.push(rf)
      if (rf.relatedEntityName && rf.relatedFileBase)
        state.relationImports.set(rf.relatedEntityName, rf.relatedFileBase)
    }
    // 'never' and 'byVariant' → not in default
    return
  }

  const rf = resolveScalarField(field, enumsByName, config)
  state.allResolved.set(field.name, rf)
  if (rf.info.brand) {
    const brandName = rf.info.brand
    if (brandName === 'Decimal' && config.decimalType === 'Decimal') {
      const brandTag = field.docs.tags.find((t) => t.kind === 'brand')
      const ctx: { modelName: string; fieldName: string; docLine?: number } = {
        modelName,
        fieldName: field.name,
      }
      if (brandTag?.line !== undefined) ctx.docLine = brandTag.line
      throw new NesorError(
        `@nesor-brand "Decimal" on field ${modelName}.${field.name} collides with the runtime Decimal type that nesor auto-imports when decimalType=Decimal.`,
        'Rename the brand (e.g. DecimalAmount) or set decimalType="string" / "number" in the generator block.',
        ctx,
      )
    }
    if (!state.brands.some((b) => b.name === brandName)) {
      const baseType =
        field.kind === 'enum'
          ? enumToTs(field.type, enumsByName, config)
          : scalarToTs(field.type, config)
      state.brands.push({ name: brandName, baseType })
    }
  }
  if (!isExcluded) state.defaultList.push(rf)
}

function ensureVariantNamesExist(model: WalkedModel, declaredNames: ReadonlySet<string>): void {
  for (const f of model.fields) {
    for (const v of variantsTargetedBy(f, 'exclude-from')) {
      if (!declaredNames.has(v)) {
        const tag = f.docs.tags.find((t) => t.kind === 'exclude-from')
        const ctx: { modelName: string; fieldName: string; docLine?: number } = {
          modelName: model.name,
          fieldName: f.name,
        }
        if (tag?.line !== undefined) ctx.docLine = tag.line
        throw new NesorError(
          `Field ${model.name}.${f.name} @nesor-exclude-from references undeclared variant "${v}".`,
          undefined,
          ctx,
        )
      }
    }
    for (const v of variantsTargetedBy(f, 'include-in')) {
      if (!declaredNames.has(v)) {
        const tag = f.docs.tags.find((t) => t.kind === 'include-in')
        const ctx: { modelName: string; fieldName: string; docLine?: number } = {
          modelName: model.name,
          fieldName: f.name,
        }
        if (tag?.line !== undefined) ctx.docLine = tag.line
        throw new NesorError(
          `Field ${model.name}.${f.name} @nesor-include-in references undeclared variant "${v}".`,
          undefined,
          ctx,
        )
      }
    }
  }
}

interface VariantBase {
  fields: ResolvedField[]
  extendsDefault: boolean
}

function selectVariantBase(decl: VariantDecl, state: FieldsState): VariantBase {
  if (decl.include) {
    const fields = decl.include
      .map((name) => state.allResolved.get(name) ?? state.relationResolved.get(name))
      .filter((f): f is ResolvedField => f !== undefined)
    return { fields, extendsDefault: false }
  }
  if (decl.exclude) {
    const exSet = new Set(decl.exclude)
    return { fields: state.defaultList.filter((f) => !exSet.has(f.source)), extendsDefault: false }
  }
  return { fields: [...state.defaultList], extendsDefault: true }
}

function applyFieldOverrides(
  base: VariantBase,
  decl: VariantDecl,
  state: FieldsState,
): { fields: ResolvedField[]; presentSources: Set<string>; extendsDefault: boolean } {
  const drops = state.dropsByVariant.get(decl.name) ?? new Set<string>()
  let fields = base.fields.filter((f) => !drops.has(f.source))
  // include-in: force-include fields excluded by DSL
  const forced = state.forcedByVariant.get(decl.name) ?? new Set<string>()
  const presentSources = new Set(fields.map((f) => f.source))
  for (const fname of forced) {
    if (presentSources.has(fname)) continue
    const rf = state.allResolved.get(fname) ?? state.relationResolved.get(fname)
    if (rf) {
      fields = [...fields, rf]
      presentSources.add(fname)
    }
  }
  // If drops removed something from the default, the variant no longer extends default cleanly.
  const extendsDefault = base.extendsDefault && drops.size === 0
  return { fields, presentSources, extendsDefault }
}

function appendWithRelations(
  decl: VariantDecl,
  presentSources: ReadonlySet<string>,
  state: FieldsState,
): ResolvedField[] {
  if (!decl.withRelations) return []
  const extras: ResolvedField[] = []
  for (const rname of decl.withRelations) {
    if (presentSources.has(rname)) continue
    const rf = state.relationResolved.get(rname)
    if (!rf) continue
    extras.push(rf)
    if (rf.relatedEntityName && rf.relatedFileBase)
      state.relationImports.set(rf.relatedEntityName, rf.relatedFileBase)
  }
  return extras
}

function resolveOneVariant(decl: VariantDecl, state: FieldsState): ResolvedVariant {
  const base = selectVariantBase(decl, state)
  const { fields, presentSources, extendsDefault } = applyFieldOverrides(base, decl, state)
  const extras = appendWithRelations(decl, presentSources, state)
  const meta = {
    ...(decl.include ? { include: decl.include } : {}),
    ...(decl.exclude ? { exclude: decl.exclude } : {}),
    ...(decl.withRelations ? { withRelations: decl.withRelations } : {}),
  }
  return extendsDefault
    ? { name: decl.name, fields: [...fields, ...extras], extendsDefault: true, extras, meta }
    : { name: decl.name, fields: [...fields, ...extras], extendsDefault: false, extras: [], meta }
}

/** Resolve a WalkedModel into the data the emitter needs. Returns null for @nesor-skip models. */
export function resolveModel(
  model: WalkedModel,
  schema: WalkedSchema,
  config: NesorConfig,
): ResolvedModel | null {
  if (model.docs.tags.some((t) => t.kind === 'skip')) return null

  const enumsByName = new Map(schema.enums.map((e) => [e.name, e] as const))
  const modelsByName = new Map(schema.models.map((m) => [m.name, m] as const))
  const entityBase = entityBaseOf(model)
  const fileBase = toFileBaseName(model.name, config.fileNameStyle)

  const variantDecls = declaredVariants(model)
  const declaredNames = new Set(variantDecls.map((v) => v.name))
  for (const v of variantDecls) validateVariantReferences(v, model, model.name)
  ensureVariantNamesExist(model, declaredNames)

  const state = newFieldsState()
  for (const f of model.fields) {
    processField(f, model.name, state, enumsByName, modelsByName, config)
  }

  const variants = variantDecls.map((d) => resolveOneVariant(d, state))

  // Remove self-imports
  const selfEntityName = `${entityBase}${config.entitySuffix}`
  state.relationImports.delete(selfEntityName)

  return {
    modelName: model.name,
    entityBase,
    fileBase,
    outputBase: computeOutputBase(model, config),
    description: model.docs.description,
    default: state.defaultList,
    excluded: state.excluded,
    secrets: state.secrets,
    variants,
    relationImports: state.relationImports,
    brands: state.brands,
  }
}
