import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, type NesorConfig } from '../../../src/config.js'
import type { WalkedField, WalkedModel, WalkedSchema } from '../../../src/dmmf/walker.js'
import { emitSingleFile } from '../../../src/emit/single.js'
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

const single: NesorConfig = { ...DEFAULT_CONFIG, splitMode: 'single' }

describe('splitMode=single', () => {
  it('emits exactly one file with all models', () => {
    const a = model('ModelA', [field('ModelA', 'id', 'String', 'scalar', { isId: true })])
    const b = model('ModelB', [field('ModelB', 'id', 'String', 'scalar', { isId: true })])
    const out = emitSingleFile(schema([a, b]), single)
    expect(out).not.toBeNull()
    expect(out?.path).toBe('entities.entity.ts')
    expect(out?.text).toContain('export interface ModelAEntity {')
    expect(out?.text).toContain('export interface ModelBEntity {')
    expect(out?.text).toContain('export const ModelAEntityMeta =')
    expect(out?.text).toContain('export const ModelBEntityMeta =')
  })

  it('skips @nesor-skip models', () => {
    const a = model('ModelA', [field('ModelA', 'id', 'String', 'scalar', { isId: true })])
    const b = model(
      'Skippable',
      [field('Skippable', 'id', 'String', 'scalar', { isId: true })],
      '@nesor-skip',
    )
    const out = emitSingleFile(schema([a, b]), single)
    expect(out?.text).toContain('ModelAEntity')
    expect(out?.text).not.toContain('SkippableEntity')
  })

  it('returns null when no models remain after @nesor-skip', () => {
    const a = model(
      'OnlyOne',
      [field('OnlyOne', 'id', 'String', 'scalar', { isId: true })],
      '@nesor-skip',
    )
    expect(emitSingleFile(schema([a]), single)).toBeNull()
  })

  it('does not emit per-file relation imports (everything is in scope)', () => {
    const child = model('ModelB', [field('ModelB', 'id', 'String', 'scalar', { isId: true })])
    const parent = model('ModelA', [
      field('ModelA', 'id', 'String', 'scalar', { isId: true }),
      field('ModelA', 'b', 'ModelB', 'object'),
    ])
    const out = emitSingleFile(schema([parent, child]), {
      ...single,
      includeRelations: 'required',
    })
    expect(out?.text).not.toContain('import type { ModelBEntity }')
    expect(out?.text).toContain('b: ModelBEntity')
  })

  it('deduplicates brand declarations across models', () => {
    const a = model('ModelA', [
      field('ModelA', 'id', 'String', 'scalar', { isId: true, docs: '@nesor-brand SharedId' }),
    ])
    const b = model('ModelB', [
      field('ModelB', 'id', 'String', 'scalar', { isId: true, docs: '@nesor-brand SharedId' }),
    ])
    const out = emitSingleFile(schema([a, b]), single)
    const matches = out?.text.match(/export type SharedId =/g) ?? []
    expect(matches).toHaveLength(1)
  })

  it('consolidates enum imports across models when enumStrategy != inline', () => {
    const a = model('ModelA', [
      field('ModelA', 'id', 'String', 'scalar', { isId: true }),
      field('ModelA', 'status', 'StatusA', 'enum'),
    ])
    const b = model('ModelB', [
      field('ModelB', 'id', 'String', 'scalar', { isId: true }),
      field('ModelB', 'status', 'StatusA', 'enum'),
    ])
    const s = schema([a, b], [{ name: 'StatusA', values: ['Active'], documentation: undefined }])
    const out = emitSingleFile(s, { ...single, enumStrategy: 'import' })
    const importLines = (out?.text.match(/import type \{ StatusA \}/g) ?? []).length
    expect(importLines).toBe(1)
  })

  it('uses the "all models" banner label', () => {
    const a = model('ModelA', [field('ModelA', 'id', 'String', 'scalar', { isId: true })])
    const out = emitSingleFile(schema([a]), single)
    expect(out?.text).toContain('→ all models')
  })

  it('emits no @prisma/client enum import when enumStrategy=inline (default)', () => {
    const a = model('ModelA', [
      field('ModelA', 'id', 'String', 'scalar', { isId: true }),
      field('ModelA', 'status', 'StatusA', 'enum'),
    ])
    const s = schema([a], [{ name: 'StatusA', values: ['Active'], documentation: undefined }])
    const out = emitSingleFile(s, single)
    expect(out?.text).not.toContain("from '@prisma/client'")
    expect(out?.text).not.toMatch(/import type \{ StatusA \}/)
  })

  it('auto-imports Decimal when decimalType=Decimal and a Decimal field exists', () => {
    const a = model('ModelA', [
      field('ModelA', 'id', 'String', 'scalar', { isId: true }),
      field('ModelA', 'amount', 'Decimal', 'scalar'),
    ])
    const out = emitSingleFile(schema([a]), { ...single, decimalType: 'Decimal' })
    expect(out?.text).toContain("import type { Decimal } from '@prisma/client/runtime/library'")
    expect(out?.text).toMatch(/amount: Decimal\b/)
  })

  it('does not emit the Decimal import when decimalType is "string"', () => {
    const a = model('ModelA', [
      field('ModelA', 'id', 'String', 'scalar', { isId: true }),
      field('ModelA', 'amount', 'Decimal', 'scalar'),
    ])
    const out = emitSingleFile(schema([a]), single)
    expect(out?.text).not.toContain('@prisma/client/runtime/library')
  })
})
