import { NesorError, type SourceContext } from '../util/diagnostics.js'
import { suggestKey } from '../util/levenshtein.js'
import { ALL_TAG_NAMES, FUTURE_TAGS, IDENTIFIER_RE, type ParseContext, describe } from './tags.js'

export interface RawLine {
  /** 1-based line index within the doc-comment block. */
  line: number
  tag: string
  rest: string
}

function toContext(ctx: ParseContext, docLine?: number): SourceContext {
  const out: SourceContext = { modelName: ctx.modelName }
  if (ctx.fieldName) out.fieldName = ctx.fieldName
  if (docLine !== undefined) out.docLine = docLine
  return out
}

/** Build a NesorError pre-populated with the parser's source context. */
export function pErr(
  ctx: ParseContext,
  docLine: number | undefined,
  message: string,
  hint?: string,
): NesorError {
  return new NesorError(message, hint, toContext(ctx, docLine))
}

/** Split a doc-comment string into description lines and structured raw tag lines. */
export function tokenizeTagLines(
  docs: string,
  ctx: ParseContext,
): { description: string[]; raw: RawLine[] } {
  const description: string[] = []
  const raw: RawLine[] = []
  const lines = docs.split('\n')
  for (const [idx, line] of lines.entries()) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('@nesor-')) {
      description.push(line)
      continue
    }
    const m = trimmed.match(/^@nesor-([a-z][a-z-]*)(?:\s+(.+))?$/)
    if (!m || m[1] === undefined) {
      throw pErr(
        ctx,
        idx + 1,
        `Malformed Nesor DSL tag (doc line ${idx + 1}): "${trimmed}"`,
        'Tags look like @nesor-<name> [arg]',
      )
    }
    raw.push({ line: idx + 1, tag: m[1], rest: (m[2] ?? '').trim() })
  }
  return { description, raw }
}

/** Reject an unknown tag with a Levenshtein suggestion or a future-version notice. */
export function rejectUnknownTag(tag: string, line: number, ctx: ParseContext): never {
  if (FUTURE_TAGS.includes(tag as (typeof FUTURE_TAGS)[number])) {
    throw pErr(
      ctx,
      line,
      `Nesor DSL tag "@nesor-${tag}" on ${describe(ctx)} (doc line ${line}) is documented in the spec but not yet supported in this version of nesor.`,
      'See nesor CHANGELOG; this tag is planned for a future release.',
    )
  }
  const known = ALL_TAG_NAMES.filter(
    (n) => !FUTURE_TAGS.includes(n as (typeof FUTURE_TAGS)[number]),
  )
  const guess = suggestKey(tag, known, 3)
  throw pErr(
    ctx,
    line,
    `Unknown Nesor DSL tag "@nesor-${tag}" on ${describe(ctx)} (doc line ${line}).`,
    guess
      ? `Did you mean "@nesor-${guess}"? See https://nesor.dev/docs/dsl`
      : 'See https://nesor.dev/docs/dsl',
  )
}

/** Parse a comma-separated identifier list, validating each entry. */
export function parseIdentifierList(value: string, tagLabel: string, ctx: ParseContext): string[] {
  const items = value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  if (items.length === 0) {
    throw pErr(
      ctx,
      undefined,
      `@nesor-${tagLabel} requires at least one name on ${describe(ctx)}.`,
      `Example: /// @nesor-${tagLabel} VariantA,VariantB`,
    )
  }
  for (const it of items) {
    if (!IDENTIFIER_RE.test(it)) {
      throw pErr(
        ctx,
        undefined,
        `@nesor-${tagLabel} item "${it}" is not a valid identifier on ${describe(ctx)}.`,
      )
    }
  }
  return items
}
