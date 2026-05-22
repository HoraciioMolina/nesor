export interface SourceLookup {
  modelName: string
  fieldName?: string
  /** 1-based line within the doc-comment block. */
  docLine?: number
}

export interface LocatedLine {
  /** 1-based absolute line in the schema text. */
  line: number
  /** 1-based column of the tag or token of interest. */
  col: number
  /** The full source line, without the trailing newline. */
  text: string
  /** When the locator can identify the token, the underline range within `text`. */
  underline?: { start: number; length: number }
}

const MODEL_HEAD = /^\s*model\s+([A-Za-z_$][\w$]*)\s*\{/
const FIELD_HEAD = /^\s*([A-Za-z_$][\w$]*)\s+/
const DOC_LINE = /^\s*\/\/\//

function findModelLine(lines: readonly string[], modelName: string): number | undefined {
  for (const [idx, line] of lines.entries()) {
    const m = MODEL_HEAD.exec(line)
    if (m?.[1] === modelName) return idx
  }
  return undefined
}

function findModelClosingBrace(lines: readonly string[], modelHeadIdx: number): number | undefined {
  let depth = 0
  let opened = false
  for (let i = modelHeadIdx; i < lines.length; i++) {
    const line = lines[i] ?? ''
    for (const ch of line) {
      if (ch === '{') {
        depth++
        opened = true
      } else if (ch === '}') {
        depth--
        if (opened && depth === 0) return i
      }
    }
  }
  return undefined
}

function findFieldLine(
  lines: readonly string[],
  modelHeadIdx: number,
  closingIdx: number,
  fieldName: string,
): number | undefined {
  for (let i = modelHeadIdx + 1; i < closingIdx; i++) {
    const line = lines[i] ?? ''
    if (DOC_LINE.test(line)) continue
    const m = FIELD_HEAD.exec(line)
    if (m?.[1] === fieldName) return i
  }
  return undefined
}

function docBlockBefore(lines: readonly string[], anchorIdx: number): number[] {
  const block: number[] = []
  for (let i = anchorIdx - 1; i >= 0; i--) {
    const line = lines[i] ?? ''
    if (DOC_LINE.test(line)) {
      block.unshift(i)
    } else if (line.trim().length === 0) {
      // allow blank lines to break the block
      break
    } else {
      break
    }
  }
  return block
}

function buildLocatedLine(text: string): LocatedLine {
  const atIdx = text.indexOf('@nesor-')
  if (atIdx < 0) return { line: 0, col: 1, text }
  // underline from @ until first whitespace (or end of line)
  const after = text.slice(atIdx)
  const tail = after.match(/^@nesor-[a-z-]+/)
  const underlineLen = tail ? tail[0].length : after.length
  return {
    line: 0,
    col: atIdx + 1,
    text,
    underline: { start: atIdx, length: underlineLen },
  }
}

/** Locate a (modelName, fieldName?, docLine?) reference in a schema.prisma source. */
export function locateInSchema(schemaText: string, lookup: SourceLookup): LocatedLine | undefined {
  const lines = schemaText.split('\n')
  const modelIdx = findModelLine(lines, lookup.modelName)
  if (modelIdx === undefined) return undefined

  let anchorIdx = modelIdx
  if (lookup.fieldName) {
    const closingIdx = findModelClosingBrace(lines, modelIdx)
    if (closingIdx === undefined) return undefined
    const fieldIdx = findFieldLine(lines, modelIdx, closingIdx, lookup.fieldName)
    if (fieldIdx === undefined) return undefined
    anchorIdx = fieldIdx
  }

  if (lookup.docLine !== undefined) {
    const block = docBlockBefore(lines, anchorIdx)
    const targetIdx = block[lookup.docLine - 1]
    if (targetIdx === undefined) return undefined
    const located = buildLocatedLine(lines[targetIdx] ?? '')
    located.line = targetIdx + 1
    return located
  }

  const text = lines[anchorIdx] ?? ''
  return { line: anchorIdx + 1, col: text.search(/\S/) + 1, text }
}
