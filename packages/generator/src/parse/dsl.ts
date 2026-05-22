// Barrel for the DSL parser. The implementation is split across:
//   tags.ts      — types + tag-name constants + `describe` helper
//   tokenize.ts  — line tokenizer + unknown-tag rejection + identifier list parser
//   field.ts     — field-level tag parser (parseFieldDocs)
//   model.ts     — model-level tag parser (parseModelDocs)

export type { FieldTag, ModelTag, ParseContext, ParsedFieldDocs, ParsedModelDocs } from './tags.js'
export { parseFieldDocs } from './field.js'
export { parseModelDocs } from './model.js'
