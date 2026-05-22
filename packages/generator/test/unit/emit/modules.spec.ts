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

function emit(m: WalkedModel, s: WalkedSchema, c: NesorConfig): EmittedFile {
  const out = emitModelFile(m, s, c)
  if (!out) throw new Error('expected emission')
  return out
}

const perModule: NesorConfig = {
  ...DEFAULT_CONFIG,
  splitMode: 'perModule',
  includeRelations: 'required',
}

describe('module routing (splitMode=perModule)', () => {
  it('routes a tagged model into the named subfolder', () => {
    const m = model(
      'ModelA',
      [field('ModelA', 'id', 'String', 'scalar', { isId: true })],
      '@nesor-module billing',
    )
    const out = emit(m, schema([m]), perModule)
    expect(out.path).toBe('billing/model-a.entity.ts')
  })

  it('keeps untagged models at the output root', () => {
    const m = model('ModelA', [field('ModelA', 'id', 'String', 'scalar', { isId: true })])
    const out = emit(m, schema([m]), perModule)
    expect(out.path).toBe('model-a.entity.ts')
  })

  it('computes cross-module relation imports with ../ paths', () => {
    const child = model(
      'ModelB',
      [field('ModelB', 'id', 'String', 'scalar', { isId: true })],
      '@nesor-module billing',
    )
    const parent = model(
      'ModelA',
      [
        field('ModelA', 'id', 'String', 'scalar', { isId: true }),
        field('ModelA', 'b', 'ModelB', 'object'),
      ],
      '@nesor-module identity',
    )
    const out = emit(parent, schema([parent, child]), perModule)
    expect(out.path).toBe('identity/model-a.entity.ts')
    expect(out.text).toContain("import type { ModelBEntity } from '../billing/model-b.entity.js'")
  })

  it('computes relation imports inside the same module without ../', () => {
    const child = model(
      'ModelB',
      [field('ModelB', 'id', 'String', 'scalar', { isId: true })],
      '@nesor-module billing',
    )
    const parent = model(
      'ModelA',
      [
        field('ModelA', 'id', 'String', 'scalar', { isId: true }),
        field('ModelA', 'b', 'ModelB', 'object'),
      ],
      '@nesor-module billing',
    )
    const out = emit(parent, schema([parent, child]), perModule)
    expect(out.text).toContain("import type { ModelBEntity } from './model-b.entity.js'")
  })
})
