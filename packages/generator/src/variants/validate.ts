import type { WalkedField, WalkedModel } from '../dmmf/walker.js'
import { NesorError, type SourceContext } from '../util/diagnostics.js'
import type { VariantDecl } from './types.js'

/** Extract all @nesor-variant declarations from a model's docs into resolver-internal shape. */
export function declaredVariants(model: WalkedModel): VariantDecl[] {
  return model.docs.tags
    .filter((t) => t.kind === 'variant')
    .map((t) => {
      if (t.kind !== 'variant') throw new Error('unreachable')
      const out: VariantDecl = { name: t.name, docLine: t.line }
      if (t.include) out.include = t.include
      if (t.exclude) out.exclude = t.exclude
      if (t.withRelations) out.withRelations = t.withRelations
      return out
    })
}

function variantCtx(modelName: string, decl: VariantDecl): SourceContext {
  return { modelName, docLine: decl.docLine }
}

/** Validate that a variant declaration refers to fields/relations that actually exist on the model. */
export function validateVariantReferences(
  decl: VariantDecl,
  model: WalkedModel,
  modelName: string,
): void {
  const allFieldNames = new Set(model.fields.map((f) => f.name))
  const relationNames = new Set(model.fields.filter((f) => f.kind === 'object').map((f) => f.name))
  const ctx = variantCtx(modelName, decl)

  for (const f of decl.include ?? []) {
    if (!allFieldNames.has(f))
      throw new NesorError(
        `Variant "${decl.name}" on model ${modelName} references unknown field "${f}" in include=.`,
        undefined,
        ctx,
      )
  }
  for (const f of decl.exclude ?? []) {
    if (!allFieldNames.has(f))
      throw new NesorError(
        `Variant "${decl.name}" on model ${modelName} references unknown field "${f}" in exclude=.`,
        undefined,
        ctx,
      )
  }
  for (const r of decl.withRelations ?? []) {
    if (!relationNames.has(r))
      throw new NesorError(
        `Variant "${decl.name}" on model ${modelName} references "${r}" in withRelations=, but no relation by that name exists.`,
        undefined,
        ctx,
      )
  }
}

/** Variant names that this field targets via @nesor-exclude-from / @nesor-include-in. */
export function variantsTargetedBy(
  field: WalkedField,
  kind: 'exclude-from' | 'include-in',
): readonly string[] {
  const tag = field.docs.tags.find((t) => t.kind === kind)
  if (!tag) return []
  if (tag.kind === 'exclude-from' || tag.kind === 'include-in') return tag.variants
  return []
}
