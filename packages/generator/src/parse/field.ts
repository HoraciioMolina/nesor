import {
  FIELD_TAGS,
  type FieldTag,
  IDENTIFIER_RE,
  MODEL_TAGS,
  type ParseContext,
  type ParsedFieldDocs,
  describe,
} from './tags.js'
import { pErr, parseIdentifierList, rejectUnknownTag, tokenizeTagLines } from './tokenize.js'

function rejectModelTagOnField(tag: string, line: number, ctx: ParseContext): void {
  if (MODEL_TAGS.includes(tag as (typeof MODEL_TAGS)[number])) {
    throw pErr(
      ctx,
      line,
      `Nesor DSL tag "@nesor-${tag}" is only valid on a model, not on ${describe(ctx)} (doc line ${line}).`,
    )
  }
}

function ensureKnownFieldTag(tag: string, line: number, ctx: ParseContext): void {
  if (FIELD_TAGS.includes(tag as (typeof FIELD_TAGS)[number])) return
  rejectUnknownTag(tag, line, ctx)
}

/** Parse a field's doc comment into a description and structured tags. */
export function parseFieldDocs(docs: string | undefined, ctx: ParseContext): ParsedFieldDocs {
  if (!docs) return { description: '', tags: [] }
  const { description, raw } = tokenizeTagLines(docs, ctx)
  const tags: FieldTag[] = []
  let excluded = false
  let renamed: string | undefined
  let secret = false
  const seenExcludeFrom = new Set<string>()
  const seenIncludeIn = new Set<string>()
  let brand: string | undefined

  for (const r of raw) {
    rejectModelTagOnField(r.tag, r.line, ctx)
    ensureKnownFieldTag(r.tag, r.line, ctx)

    if (r.tag === 'exclude') {
      if (r.rest)
        throw pErr(
          ctx,
          r.line,
          `@nesor-exclude takes no arguments on ${describe(ctx)} (doc line ${r.line}); got "${r.rest}".`,
        )
      if (excluded) throw pErr(ctx, r.line, `@nesor-exclude appears twice on ${describe(ctx)}.`)
      excluded = true
      tags.push({ kind: 'exclude', line: r.line })
    } else if (r.tag === 'secret') {
      if (r.rest)
        throw pErr(
          ctx,
          r.line,
          `@nesor-secret takes no arguments on ${describe(ctx)} (doc line ${r.line}); got "${r.rest}".`,
        )
      if (secret) throw pErr(ctx, r.line, `@nesor-secret appears twice on ${describe(ctx)}.`)
      secret = true
      tags.push({ kind: 'secret', line: r.line })
    } else if (r.tag === 'rename') {
      if (!r.rest)
        throw pErr(
          ctx,
          r.line,
          `@nesor-rename requires a new field name on ${describe(ctx)} (doc line ${r.line}).`,
          'Example: /// @nesor-rename newFieldName',
        )
      if (!IDENTIFIER_RE.test(r.rest)) {
        throw pErr(
          ctx,
          r.line,
          `@nesor-rename argument "${r.rest}" is not a valid TypeScript identifier on ${describe(ctx)}.`,
        )
      }
      if (renamed)
        throw pErr(
          ctx,
          r.line,
          `@nesor-rename appears twice on ${describe(ctx)}; pick one target name.`,
        )
      renamed = r.rest
      tags.push({ kind: 'rename', to: r.rest, line: r.line })
    } else if (r.tag === 'exclude-from') {
      const variants = parseIdentifierList(r.rest, 'exclude-from', ctx)
      for (const v of variants) {
        if (seenExcludeFrom.has(v))
          throw pErr(
            ctx,
            r.line,
            `@nesor-exclude-from references variant "${v}" twice on ${describe(ctx)}.`,
          )
        seenExcludeFrom.add(v)
      }
      tags.push({ kind: 'exclude-from', variants, line: r.line })
    } else if (r.tag === 'include-in') {
      const variants = parseIdentifierList(r.rest, 'include-in', ctx)
      for (const v of variants) {
        if (seenIncludeIn.has(v))
          throw pErr(
            ctx,
            r.line,
            `@nesor-include-in references variant "${v}" twice on ${describe(ctx)}.`,
          )
        seenIncludeIn.add(v)
      }
      tags.push({ kind: 'include-in', variants, line: r.line })
    } else if (r.tag === 'brand') {
      if (!r.rest)
        throw pErr(
          ctx,
          r.line,
          `@nesor-brand requires a brand name on ${describe(ctx)} (doc line ${r.line}).`,
          'Example: /// @nesor-brand UserId',
        )
      if (!IDENTIFIER_RE.test(r.rest))
        throw pErr(
          ctx,
          r.line,
          `@nesor-brand argument "${r.rest}" is not a valid TypeScript identifier on ${describe(ctx)}.`,
        )
      if (brand) throw pErr(ctx, r.line, `@nesor-brand appears twice on ${describe(ctx)}.`)
      brand = r.rest
      tags.push({ kind: 'brand', name: r.rest, line: r.line })
    }
  }

  if (excluded && renamed) {
    throw pErr(
      ctx,
      undefined,
      `@nesor-rename is meaningless when @nesor-exclude is also present on ${describe(ctx)}.`,
      'Pick one: either exclude the field or rename it.',
    )
  }
  if (secret && renamed) {
    throw pErr(
      ctx,
      undefined,
      `@nesor-rename is meaningless when @nesor-secret is also present on ${describe(ctx)} (secret excludes the field).`,
    )
  }
  if (secret && seenIncludeIn.size > 0) {
    throw pErr(
      ctx,
      undefined,
      `@nesor-include-in cannot be combined with @nesor-secret on ${describe(ctx)}.`,
      'A field marked secret should not be re-introduced in any variant. Use @nesor-exclude + @nesor-include-in if you need that.',
    )
  }

  return { description: description.join('\n').trim(), tags }
}
