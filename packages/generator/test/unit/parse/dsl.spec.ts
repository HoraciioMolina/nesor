import { describe, expect, it } from 'vitest'
import { parseFieldDocs, parseModelDocs } from '../../../src/parse/dsl.js'
import { NesorError } from '../../../src/util/diagnostics.js'

const fieldCtx = { modelName: 'ModelA', fieldName: 'fieldX' }
const modelCtx = { modelName: 'ModelA' }

describe('parseFieldDocs', () => {
  it('returns empty parse for undefined input', () => {
    expect(parseFieldDocs(undefined, fieldCtx)).toEqual({ description: '', tags: [] })
  })

  it('preserves non-tag lines as description', () => {
    const docs = parseFieldDocs('First line.\nSecond line.', fieldCtx)
    expect(docs.description).toBe('First line.\nSecond line.')
    expect(docs.tags).toEqual([])
  })

  it('parses @nesor-exclude', () => {
    const docs = parseFieldDocs('@nesor-exclude', fieldCtx)
    expect(docs.tags).toEqual([{ kind: 'exclude', line: 1 }])
  })

  it('parses @nesor-rename with identifier', () => {
    const docs = parseFieldDocs('@nesor-rename newName', fieldCtx)
    expect(docs.tags).toEqual([{ kind: 'rename', to: 'newName', line: 1 }])
  })

  it('parses @nesor-secret', () => {
    const docs = parseFieldDocs('@nesor-secret', fieldCtx)
    expect(docs.tags).toEqual([{ kind: 'secret', line: 1 }])
  })

  it('rejects unknown tag with Levenshtein suggestion', () => {
    try {
      parseFieldDocs('@nesor-exclud', fieldCtx)
      throw new Error('expected to throw')
    } catch (err) {
      expect(err).toBeInstanceOf(NesorError)
      expect((err as NesorError).hint).toContain('@nesor-exclude')
    }
  })

  it('errors on @nesor-rename without identifier', () => {
    expect(() => parseFieldDocs('@nesor-rename', fieldCtx)).toThrow(/requires a new field name/)
  })

  it('errors on @nesor-rename with invalid identifier', () => {
    expect(() => parseFieldDocs('@nesor-rename not a name', fieldCtx)).toThrow(
      /not a valid TypeScript identifier/,
    )
  })

  it('errors on @nesor-exclude with stray argument', () => {
    expect(() => parseFieldDocs('@nesor-exclude oops', fieldCtx)).toThrow(/takes no arguments/)
  })

  it('rejects @nesor-skip on a field', () => {
    expect(() => parseFieldDocs('@nesor-skip', fieldCtx)).toThrow(/only valid on a model/)
  })

  it('rejects future-phase tags as not yet supported', () => {
    expect(() => parseFieldDocs('@nesor-readonly', fieldCtx)).toThrow(/not yet supported/)
  })

  it('parses @nesor-brand', () => {
    const docs = parseFieldDocs('@nesor-brand UserId', fieldCtx)
    expect(docs.tags).toEqual([{ kind: 'brand', name: 'UserId', line: 1 }])
  })

  it('rejects @nesor-brand without an identifier', () => {
    expect(() => parseFieldDocs('@nesor-brand', fieldCtx)).toThrow(/requires a brand name/)
  })

  it('parses @nesor-exclude-from with multiple variants', () => {
    const docs = parseFieldDocs('@nesor-exclude-from Compact,Detailed', fieldCtx)
    expect(docs.tags).toEqual([
      { kind: 'exclude-from', variants: ['Compact', 'Detailed'], line: 1 },
    ])
  })

  it('parses @nesor-include-in', () => {
    const docs = parseFieldDocs('@nesor-exclude\n@nesor-include-in Internal', fieldCtx)
    expect(docs.tags).toHaveLength(2)
    expect(docs.tags[1]).toEqual({ kind: 'include-in', variants: ['Internal'], line: 2 })
  })

  it('rejects @nesor-include-in combined with @nesor-secret', () => {
    expect(() => parseFieldDocs('@nesor-secret\n@nesor-include-in Internal', fieldCtx)).toThrow(
      /cannot be combined with @nesor-secret/,
    )
  })

  it('rejects @nesor-rename combined with @nesor-exclude', () => {
    expect(() => parseFieldDocs('@nesor-exclude\n@nesor-rename newName', fieldCtx)).toThrow(
      /meaningless/,
    )
  })

  it('rejects double @nesor-rename', () => {
    expect(() => parseFieldDocs('@nesor-rename a\n@nesor-rename b', fieldCtx)).toThrow(
      /appears twice/,
    )
  })

  it('keeps description lines separate from tags', () => {
    const docs = parseFieldDocs('Some prose.\n@nesor-rename otherName\nMore prose.', fieldCtx)
    expect(docs.description).toBe('Some prose.\nMore prose.')
    expect(docs.tags).toEqual([{ kind: 'rename', to: 'otherName', line: 2 }])
  })
})

describe('parseModelDocs', () => {
  it('parses @nesor-skip', () => {
    const docs = parseModelDocs('@nesor-skip', modelCtx)
    expect(docs.tags).toEqual([{ kind: 'skip', line: 1 }])
  })

  it('parses @nesor-entity-name', () => {
    const docs = parseModelDocs('@nesor-entity-name CustomName', modelCtx)
    expect(docs.tags).toEqual([{ kind: 'entity-name', name: 'CustomName', line: 1 }])
  })

  it('rejects field tag on a model', () => {
    expect(() => parseModelDocs('@nesor-exclude', modelCtx)).toThrow(/only valid on a field/)
  })

  it('rejects @nesor-entity-name without argument', () => {
    expect(() => parseModelDocs('@nesor-entity-name', modelCtx)).toThrow(/requires a name/)
  })

  it('parses @nesor-variant include=', () => {
    const docs = parseModelDocs('@nesor-variant Compact include=id,name', modelCtx)
    expect(docs.tags).toEqual([
      { kind: 'variant', name: 'Compact', include: ['id', 'name'], line: 1 },
    ])
  })

  it('parses @nesor-variant withRelations=', () => {
    const docs = parseModelDocs('@nesor-variant WithChildren withRelations=children', modelCtx)
    expect(docs.tags).toEqual([
      { kind: 'variant', name: 'WithChildren', withRelations: ['children'], line: 1 },
    ])
  })

  it('parses @nesor-variant exclude=', () => {
    const docs = parseModelDocs('@nesor-variant Slim exclude=internalNote', modelCtx)
    expect(docs.tags).toEqual([
      { kind: 'variant', name: 'Slim', exclude: ['internalNote'], line: 1 },
    ])
  })

  it('rejects @nesor-variant with no selection keys', () => {
    expect(() => parseModelDocs('@nesor-variant Bad', modelCtx)).toThrow(
      /must declare at least one/,
    )
  })

  it('rejects @nesor-variant with both include and exclude', () => {
    expect(() => parseModelDocs('@nesor-variant Bad include=a exclude=b', modelCtx)).toThrow(
      /cannot use both include and exclude/,
    )
  })

  it('rejects duplicate variant declarations', () => {
    expect(() =>
      parseModelDocs('@nesor-variant V include=a\n@nesor-variant V exclude=b', modelCtx),
    ).toThrow(/is declared twice/)
  })

  it('rejects @nesor-variant with invalid name', () => {
    expect(() => parseModelDocs('@nesor-variant 1Bad include=a', modelCtx)).toThrow(
      /not a valid identifier/,
    )
  })
})
