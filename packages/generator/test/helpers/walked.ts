import type { WalkedField, WalkedModel, WalkedSchema } from '../../src/dmmf/walker.js'
import { parseFieldDocs, parseModelDocs } from '../../src/parse/dsl.js'

/** Build a WalkedField suitable for tests/fixtures. */
export function field(
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

/** Build a WalkedModel. */
export function model(name: string, fields: WalkedField[], modelDocs?: string): WalkedModel {
  return {
    name,
    documentation: modelDocs,
    fields,
    docs: parseModelDocs(modelDocs, { modelName: name }),
  }
}

/** Build a WalkedSchema. */
export function schema(models: WalkedModel[], enums: WalkedSchema['enums'] = []): WalkedSchema {
  return { models, enums }
}
