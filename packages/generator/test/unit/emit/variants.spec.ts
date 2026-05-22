import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, type NesorConfig } from '../../../src/config.js'
import type { WalkedField, WalkedModel, WalkedSchema } from '../../../src/dmmf/walker.js'
import { type EmittedFile, emitModelFile } from '../../../src/emit/file.js'
import { parseFieldDocs, parseModelDocs } from '../../../src/parse/dsl.js'

function field(
  modelName: string,
  name: string,
  type: string,
  kind: WalkedField['kind'],
  opts: Partial<Omit<WalkedField, 'name' | 'type' | 'kind' | 'docs'>> & { docs?: string } = {},
): WalkedField {
  const { docs, ...rest } = opts
  return {
    name,
    type,
    kind,
    isList: false,
    isRequired: true,
    isId: false,
    documentation: docs,
    docs: parseFieldDocs(docs, { modelName, fieldName: name }),
    ...rest,
  }
}

function model(name: string, fields: WalkedField[], modelDocs?: string): WalkedModel {
  return {
    name,
    documentation: modelDocs,
    fields,
    docs: parseModelDocs(modelDocs, { modelName: name }),
  }
}

function schema(models: WalkedModel[], enums: WalkedSchema['enums'] = []): WalkedSchema {
  return { models, enums }
}

function emit(m: WalkedModel, s: WalkedSchema, c: NesorConfig = DEFAULT_CONFIG): EmittedFile {
  const out = emitModelFile(m, s, c)
  if (!out) throw new Error('expected emission')
  return out
}

describe('variants', () => {
  it('emits a Compact variant with include=', () => {
    const m = model(
      'ModelA',
      [
        field('ModelA', 'id', 'String', 'scalar', { isId: true }),
        field('ModelA', 'name', 'String', 'scalar'),
        field('ModelA', 'count', 'Int', 'scalar'),
        field('ModelA', 'extra', 'String', 'scalar'),
      ],
      '@nesor-variant Compact include=id,name',
    )
    const out = emit(m, schema([m]))
    expect(out.text).toContain('export interface ModelACompactEntity {')
    expect(out.text).toMatch(/ModelACompactEntity\s+\{[^}]+id: string[^}]+name: string[^}]+\}/s)
    expect(out.text).not.toMatch(/ModelACompactEntity\s+\{[^}]+count:/s)
  })

  it('emits an exclude= variant as a standalone interface', () => {
    const m = model(
      'ModelA',
      [
        field('ModelA', 'id', 'String', 'scalar', { isId: true }),
        field('ModelA', 'name', 'String', 'scalar'),
        field('ModelA', 'internal', 'String', 'scalar'),
      ],
      '@nesor-variant Slim exclude=internal',
    )
    const out = emit(m, schema([m]))
    expect(out.text).toContain('export interface ModelASlimEntity {')
    expect(out.text).not.toMatch(/ModelASlimEntity\s+\{[^}]+internal:/s)
    expect(out.text).not.toContain('extends ModelAEntity')
  })

  it('uses `extends` when a withRelations-only variant just augments default', () => {
    const child = model('ModelB', [field('ModelB', 'id', 'String', 'scalar', { isId: true })])
    const parent = model(
      'ModelA',
      [
        field('ModelA', 'id', 'String', 'scalar', { isId: true }),
        field('ModelA', 'children', 'ModelB', 'object', { isList: true }),
      ],
      '@nesor-variant WithChildren withRelations=children',
    )
    const out = emit(parent, schema([parent, child]))
    expect(out.text).toContain('export interface ModelAWithChildrenEntity extends ModelAEntity {')
    expect(out.text).toContain('children: ModelBEntity[]')
    expect(out.text).toContain("import type { ModelBEntity } from './model-b.entity.js'")
  })

  it('records variants in EntityMeta.variants', () => {
    const m = model(
      'ModelA',
      [
        field('ModelA', 'id', 'String', 'scalar', { isId: true }),
        field('ModelA', 'name', 'String', 'scalar'),
      ],
      '@nesor-variant Compact include=id,name',
    )
    const out = emit(m, schema([m]))
    expect(out.text).toContain("Compact: { include: ['id', 'name'] }")
  })

  it('honors @nesor-exclude-from on a specific variant', () => {
    const m = model(
      'ModelA',
      [
        field('ModelA', 'id', 'String', 'scalar', { isId: true }),
        field('ModelA', 'name', 'String', 'scalar'),
        field('ModelA', 'volatile', 'String', 'scalar', { docs: '@nesor-exclude-from Slim' }),
      ],
      '@nesor-variant Slim exclude=name',
    )
    const out = emit(m, schema([m]))
    // Default still has volatile
    expect(out.text).toMatch(/ModelAEntity\s+\{[^}]+volatile: string[^}]+\}/s)
    // Slim variant excludes both `name` (via variant) and `volatile` (via field tag)
    expect(out.text).not.toMatch(/ModelASlimEntity\s+\{[^}]+volatile:/s)
    expect(out.text).not.toMatch(/ModelASlimEntity\s+\{[^}]+name:/s)
  })

  it('honors @nesor-include-in to re-introduce an excluded field in a specific variant', () => {
    const m = model(
      'ModelA',
      [
        field('ModelA', 'id', 'String', 'scalar', { isId: true }),
        field('ModelA', 'audit', 'String', 'scalar', {
          docs: '@nesor-exclude\n@nesor-include-in Audit',
        }),
      ],
      '@nesor-variant Audit include=id,audit',
    )
    const out = emit(m, schema([m]))
    // Default omits audit
    expect(out.text).not.toMatch(/ModelAEntity\s+\{[^}]+audit:/s)
    // Audit variant includes audit
    expect(out.text).toMatch(/ModelAAuditEntity\s+\{[^}]+audit: string[^}]+\}/s)
  })

  it('errors when a variant references an unknown field', () => {
    const m = model(
      'ModelA',
      [field('ModelA', 'id', 'String', 'scalar', { isId: true })],
      '@nesor-variant Bad include=nope',
    )
    expect(() => emitModelFile(m, schema([m]), DEFAULT_CONFIG)).toThrow(/references unknown field/)
  })

  it('errors when a withRelations references something that is not a relation', () => {
    const m = model(
      'ModelA',
      [
        field('ModelA', 'id', 'String', 'scalar', { isId: true }),
        field('ModelA', 'name', 'String', 'scalar'),
      ],
      '@nesor-variant Bad withRelations=name',
    )
    expect(() => emitModelFile(m, schema([m]), DEFAULT_CONFIG)).toThrow(/no relation by that name/)
  })
})

describe('relations', () => {
  it('drops all relations by default (includeRelations="never")', () => {
    const child = model('ModelB', [field('ModelB', 'id', 'String', 'scalar', { isId: true })])
    const parent = model('ModelA', [
      field('ModelA', 'id', 'String', 'scalar', { isId: true }),
      field('ModelA', 'children', 'ModelB', 'object', { isList: true }),
    ])
    const out = emit(parent, schema([parent, child]))
    expect(out.text).not.toContain('children:')
    expect(out.text).not.toContain('ModelBEntity')
  })

  it('emits relations as required when includeRelations="required"', () => {
    const child = model('ModelB', [field('ModelB', 'id', 'String', 'scalar', { isId: true })])
    const parent = model('ModelA', [
      field('ModelA', 'id', 'String', 'scalar', { isId: true }),
      field('ModelA', 'parent', 'ModelB', 'object'),
    ])
    const out = emit(parent, schema([parent, child]), {
      ...DEFAULT_CONFIG,
      includeRelations: 'required',
    })
    expect(out.text).toContain('parent: ModelBEntity')
    expect(out.text).toContain("import type { ModelBEntity } from './model-b.entity.js'")
  })

  it('emits relations as optional (with `?:`) when includeRelations="optional"', () => {
    const child = model('ModelB', [field('ModelB', 'id', 'String', 'scalar', { isId: true })])
    const parent = model('ModelA', [
      field('ModelA', 'id', 'String', 'scalar', { isId: true }),
      field('ModelA', 'parent', 'ModelB', 'object'),
    ])
    const out = emit(parent, schema([parent, child]), {
      ...DEFAULT_CONFIG,
      includeRelations: 'optional',
    })
    expect(out.text).toContain('parent?: ModelBEntity')
  })

  it('handles nullable one-to-one relations with `| null`', () => {
    const child = model('ModelB', [field('ModelB', 'id', 'String', 'scalar', { isId: true })])
    const parent = model('ModelA', [
      field('ModelA', 'id', 'String', 'scalar', { isId: true }),
      field('ModelA', 'parent', 'ModelB', 'object', { isRequired: false }),
    ])
    const out = emit(parent, schema([parent, child]), {
      ...DEFAULT_CONFIG,
      includeRelations: 'required',
    })
    expect(out.text).toContain('parent: ModelBEntity | null')
  })

  it('handles cyclic relations safely via `import type`', () => {
    const a = model('ModelA', [
      field('ModelA', 'id', 'String', 'scalar', { isId: true }),
      field('ModelA', 'b', 'ModelB', 'object'),
    ])
    const b = model('ModelB', [
      field('ModelB', 'id', 'String', 'scalar', { isId: true }),
      field('ModelB', 'a', 'ModelA', 'object'),
    ])
    const s = schema([a, b])
    const outA = emit(a, s, { ...DEFAULT_CONFIG, includeRelations: 'required' })
    const outB = emit(b, s, { ...DEFAULT_CONFIG, includeRelations: 'required' })
    expect(outA.text).toContain("import type { ModelBEntity } from './model-b.entity.js'")
    expect(outB.text).toContain("import type { ModelAEntity } from './model-a.entity.js'")
    expect(outA.text).toContain('b: ModelBEntity')
    expect(outB.text).toContain('a: ModelAEntity')
  })

  it('does not import the model from its own file (no self-import)', () => {
    const m = model('ModelA', [
      field('ModelA', 'id', 'String', 'scalar', { isId: true }),
      field('ModelA', 'parent', 'ModelA', 'object', { isRequired: false }),
    ])
    const out = emit(m, schema([m]), { ...DEFAULT_CONFIG, includeRelations: 'required' })
    expect(out.text).not.toContain("from './model-a.entity.js'")
  })

  it('byVariant: relations appear only in declared withRelations variants', () => {
    const child = model('ModelB', [field('ModelB', 'id', 'String', 'scalar', { isId: true })])
    const parent = model(
      'ModelA',
      [
        field('ModelA', 'id', 'String', 'scalar', { isId: true }),
        field('ModelA', 'children', 'ModelB', 'object', { isList: true }),
      ],
      '@nesor-variant WithChildren withRelations=children',
    )
    const out = emit(parent, schema([parent, child]), {
      ...DEFAULT_CONFIG,
      includeRelations: 'byVariant',
    })
    expect(out.text).not.toMatch(/interface ModelAEntity \{[^}]+children:/s)
    expect(out.text).toMatch(/ModelAWithChildrenEntity[^{]*\{[^}]+children: ModelBEntity\[\]/s)
  })
})

describe('brand', () => {
  it('emits a branded type for a String field', () => {
    const m = model('ModelA', [
      field('ModelA', 'id', 'String', 'scalar', { isId: true, docs: '@nesor-brand UserId' }),
      field('ModelA', 'name', 'String', 'scalar'),
    ])
    const out = emit(m, schema([m]))
    expect(out.text).toContain("export type UserId = string & { readonly __brand: 'UserId' }")
    expect(out.text).toContain('id: UserId')
    expect(out.text).toContain("brand: 'UserId'")
  })

  it('emits a branded type for an Int field (non-string scalar)', () => {
    const m = model('ModelA', [
      field('ModelA', 'rev', 'Int', 'scalar', { docs: '@nesor-brand Revision' }),
    ])
    const out = emit(m, schema([m]))
    expect(out.text).toContain("export type Revision = number & { readonly __brand: 'Revision' }")
    expect(out.text).toContain('rev: Revision')
  })

  it('declares each brand exactly once even when reused across variants', () => {
    const m = model(
      'ModelA',
      [
        field('ModelA', 'id', 'String', 'scalar', { isId: true, docs: '@nesor-brand IdA' }),
        field('ModelA', 'name', 'String', 'scalar'),
      ],
      '@nesor-variant Compact include=id',
    )
    const out = emit(m, schema([m]))
    const occurrences = out.text.match(/export type IdA =/g) ?? []
    expect(occurrences).toHaveLength(1)
    // Both interfaces reference the brand by name
    expect(out.text).toMatch(/ModelAEntity[\s\S]+id: IdA/)
    expect(out.text).toMatch(/ModelACompactEntity[\s\S]+id: IdA/)
  })
})
