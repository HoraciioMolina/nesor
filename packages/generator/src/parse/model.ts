import {
  FIELD_TAGS,
  IDENTIFIER_RE,
  MODEL_TAGS,
  type ModelTag,
  type ParseContext,
  type ParsedModelDocs,
  describe,
} from './tags.js'
import { pErr, parseIdentifierList, rejectUnknownTag, tokenizeTagLines } from './tokenize.js'

interface ParsedVariantArgs {
  name: string
  include?: readonly string[]
  exclude?: readonly string[]
  withRelations?: readonly string[]
}

function rejectFieldTagOnModel(tag: string, line: number, ctx: ParseContext): void {
  if (FIELD_TAGS.includes(tag as (typeof FIELD_TAGS)[number])) {
    throw pErr(
      ctx,
      line,
      `Nesor DSL tag "@nesor-${tag}" is only valid on a field, not on ${describe(ctx)} (doc line ${line}).`,
    )
  }
}

function ensureKnownModelTag(tag: string, line: number, ctx: ParseContext): void {
  if (MODEL_TAGS.includes(tag as (typeof MODEL_TAGS)[number])) return
  rejectUnknownTag(tag, line, ctx)
}

function parseVariantArgs(rest: string, ctx: ParseContext, line: number): ParsedVariantArgs {
  if (!rest) {
    throw pErr(
      ctx,
      line,
      `@nesor-variant requires a variant name on ${describe(ctx)}.`,
      'Example: /// @nesor-variant Compact include=id,name',
    )
  }
  const tokens = rest.split(/\s+/).filter((t) => t.length > 0)
  const name = tokens[0]
  if (!name || !IDENTIFIER_RE.test(name)) {
    throw pErr(
      ctx,
      line,
      `@nesor-variant name "${name ?? ''}" is not a valid identifier on ${describe(ctx)}.`,
    )
  }
  const out: {
    name: string
    include?: string[]
    exclude?: string[]
    withRelations?: string[]
  } = { name }
  const seen = new Set<string>()
  for (const t of tokens.slice(1)) {
    const eq = t.indexOf('=')
    if (eq === -1) {
      throw pErr(
        ctx,
        line,
        `@nesor-variant argument "${t}" must be key=value on ${describe(ctx)}.`,
        'Allowed keys: include, exclude, withRelations',
      )
    }
    const key = t.slice(0, eq)
    const value = t.slice(eq + 1)
    if (!['include', 'exclude', 'withRelations'].includes(key)) {
      throw pErr(
        ctx,
        line,
        `@nesor-variant: unknown key "${key}" on ${describe(ctx)}.`,
        'Allowed keys: include, exclude, withRelations',
      )
    }
    if (seen.has(key)) {
      throw pErr(
        ctx,
        line,
        `@nesor-variant key "${key}" appears twice for variant "${name}" on ${describe(ctx)}.`,
      )
    }
    seen.add(key)
    const list = parseIdentifierList(value, 'variant', ctx)
    if (key === 'include') out.include = list
    else if (key === 'exclude') out.exclude = list
    else out.withRelations = list
  }
  if (!out.include && !out.exclude && !out.withRelations) {
    throw pErr(
      ctx,
      line,
      `@nesor-variant "${name}" must declare at least one of include / exclude / withRelations on ${describe(ctx)}.`,
    )
  }
  if (out.include && out.exclude) {
    throw pErr(
      ctx,
      line,
      `@nesor-variant "${name}" cannot use both include and exclude on ${describe(ctx)}.`,
      'Pick one selection strategy.',
    )
  }
  return out
}

/** Parse a model's doc comment into a description and structured tags. */
export function parseModelDocs(docs: string | undefined, ctx: ParseContext): ParsedModelDocs {
  if (!docs) return { description: '', tags: [] }
  const { description, raw } = tokenizeTagLines(docs, ctx)
  const tags: ModelTag[] = []
  let skipped = false
  let entityName: string | undefined
  const variantNames = new Set<string>()

  for (const r of raw) {
    rejectFieldTagOnModel(r.tag, r.line, ctx)
    ensureKnownModelTag(r.tag, r.line, ctx)

    if (r.tag === 'skip') {
      if (r.rest)
        throw pErr(
          ctx,
          r.line,
          `@nesor-skip takes no arguments on ${describe(ctx)} (doc line ${r.line}); got "${r.rest}".`,
        )
      if (skipped) throw pErr(ctx, r.line, `@nesor-skip appears twice on ${describe(ctx)}.`)
      skipped = true
      tags.push({ kind: 'skip', line: r.line })
    } else if (r.tag === 'entity-name') {
      if (!r.rest)
        throw pErr(
          ctx,
          r.line,
          `@nesor-entity-name requires a name on ${describe(ctx)} (doc line ${r.line}).`,
        )
      if (!IDENTIFIER_RE.test(r.rest))
        throw pErr(
          ctx,
          r.line,
          `@nesor-entity-name argument "${r.rest}" is not a valid TypeScript identifier.`,
        )
      if (entityName)
        throw pErr(ctx, r.line, `@nesor-entity-name appears twice on ${describe(ctx)}.`)
      entityName = r.rest
      tags.push({ kind: 'entity-name', name: r.rest, line: r.line })
    } else if (r.tag === 'variant') {
      const v = parseVariantArgs(r.rest, ctx, r.line)
      if (variantNames.has(v.name))
        throw pErr(ctx, r.line, `@nesor-variant "${v.name}" is declared twice on ${describe(ctx)}.`)
      variantNames.add(v.name)
      tags.push({
        kind: 'variant',
        name: v.name,
        ...(v.include ? { include: v.include } : {}),
        ...(v.exclude ? { exclude: v.exclude } : {}),
        ...(v.withRelations ? { withRelations: v.withRelations } : {}),
        line: r.line,
      })
    } else if (r.tag === 'module') {
      if (!r.rest)
        throw pErr(
          ctx,
          r.line,
          `@nesor-module requires a path on ${describe(ctx)} (doc line ${r.line}).`,
          'Example: /// @nesor-module billing',
        )
      if (!/^[A-Za-z0-9_][\w./-]*$/.test(r.rest)) {
        throw pErr(
          ctx,
          r.line,
          `@nesor-module path "${r.rest}" is not a valid subfolder name on ${describe(ctx)}.`,
        )
      }
      if (tags.some((t) => t.kind === 'module'))
        throw pErr(ctx, r.line, `@nesor-module appears twice on ${describe(ctx)}.`)
      tags.push({ kind: 'module', path: r.rest, line: r.line })
    }
  }

  return { description: description.join('\n').trim(), tags }
}
