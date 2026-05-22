import type { DMMF } from '@prisma/generator-helper'
import {
  type ParsedFieldDocs,
  type ParsedModelDocs,
  parseFieldDocs,
  parseModelDocs,
} from '../parse/dsl.js'
import { NesorError } from '../util/diagnostics.js'

export interface WalkedField {
  name: string
  /** Raw Prisma type name: 'String', 'Int', a model name, or an enum name. */
  type: string
  kind: 'scalar' | 'enum' | 'object'
  isList: boolean
  isRequired: boolean
  isId: boolean
  documentation: string | undefined
  docs: ParsedFieldDocs
}

export interface WalkedModel {
  name: string
  documentation: string | undefined
  fields: WalkedField[]
  docs: ParsedModelDocs
}

export interface WalkedEnum {
  name: string
  values: readonly string[]
  documentation: string | undefined
}

export interface WalkedSchema {
  models: WalkedModel[]
  enums: WalkedEnum[]
}

/** Normalize a Prisma DMMF document into Nesor's internal shape. */
export function walkDocument(doc: DMMF.Document): WalkedSchema {
  const models: WalkedModel[] = doc.datamodel.models.map((m) => {
    const fields: WalkedField[] = m.fields.map((f) => {
      if (f.kind === 'unsupported') {
        throw new NesorError(
          `Field ${m.name}.${f.name} has type "${f.type}" which Prisma marks as Unsupported.`,
          'Map it to a supported scalar in schema.prisma or exclude it with /// @nesor-exclude.',
          { modelName: m.name, fieldName: f.name },
        )
      }
      if ((f.kind as string) === 'composite') {
        throw new NesorError(
          `Field ${m.name}.${f.name} uses MongoDB composite type "${f.type}", which nesor does not support yet.`,
          'Exclude the field with /// @nesor-exclude, or open an issue if you need composite-type support.',
          { modelName: m.name, fieldName: f.name },
        )
      }
      return {
        name: f.name,
        type: f.type,
        kind: f.kind,
        isList: f.isList,
        isRequired: f.isRequired,
        isId: f.isId,
        documentation: f.documentation,
        docs: parseFieldDocs(f.documentation, { modelName: m.name, fieldName: f.name }),
      }
    })
    return {
      name: m.name,
      documentation: m.documentation,
      fields,
      docs: parseModelDocs(m.documentation, { modelName: m.name }),
    }
  })
  const enums: WalkedEnum[] = doc.datamodel.enums.map((e) => ({
    name: e.name,
    values: e.values.map((v) => v.name),
    documentation: e.documentation,
  }))
  return { models, enums }
}
