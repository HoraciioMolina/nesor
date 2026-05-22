/** Doc-comment tags valid on fields. */
export type FieldTag =
  | { kind: 'exclude'; line: number }
  | { kind: 'rename'; to: string; line: number }
  | { kind: 'secret'; line: number }
  | { kind: 'exclude-from'; variants: readonly string[]; line: number }
  | { kind: 'include-in'; variants: readonly string[]; line: number }
  | { kind: 'brand'; name: string; line: number }

/** Doc-comment tags valid on models. */
export type ModelTag =
  | { kind: 'skip'; line: number }
  | { kind: 'entity-name'; name: string; line: number }
  | {
      kind: 'variant'
      name: string
      include?: readonly string[]
      exclude?: readonly string[]
      withRelations?: readonly string[]
      line: number
    }
  | { kind: 'module'; path: string; line: number }

export interface ParsedFieldDocs {
  description: string
  tags: FieldTag[]
}

export interface ParsedModelDocs {
  description: string
  tags: ModelTag[]
}

export interface ParseContext {
  modelName: string
  fieldName?: string
}

export const FIELD_TAGS = [
  'exclude',
  'rename',
  'secret',
  'exclude-from',
  'include-in',
  'brand',
] as const

export const MODEL_TAGS = ['skip', 'entity-name', 'variant', 'module'] as const

export const FUTURE_TAGS = ['type', 'readonly'] as const

export const ALL_TAG_NAMES = [...FIELD_TAGS, ...MODEL_TAGS, ...FUTURE_TAGS] as readonly string[]

export const IDENTIFIER_RE = /^[A-Za-z_$][\w$]*$/

/** Format a ParseContext into a human-readable subject string. */
export function describe(ctx: ParseContext): string {
  return ctx.fieldName ? `field ${ctx.modelName}.${ctx.fieldName}` : `model ${ctx.modelName}`
}
