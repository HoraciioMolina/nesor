import { describe, expect, it } from 'vitest'
import { locateInSchema } from '../../../src/util/source-location.js'

const SCHEMA = `generator nesor {
  provider = "nesor"
}

/// Model-level doc.
/// @nesor-variant Compact include=id,name
model ModelA {
  id   String @id

  /// Field doc.
  /// @nesor-exclud
  name String
}

model ModelB {
  id String @id
}
`

describe('locateInSchema', () => {
  it('locates a model when neither field nor doc-line is requested', () => {
    const loc = locateInSchema(SCHEMA, { modelName: 'ModelA' })
    expect(loc?.line).toBe(7)
    expect(loc?.text).toContain('model ModelA')
  })

  it('locates a field within a model', () => {
    const loc = locateInSchema(SCHEMA, { modelName: 'ModelA', fieldName: 'name' })
    expect(loc?.line).toBe(12)
    expect(loc?.text.trim()).toBe('name String')
  })

  it('locates a model-level doc line (1-based, top of block)', () => {
    const loc = locateInSchema(SCHEMA, { modelName: 'ModelA', docLine: 1 })
    expect(loc?.line).toBe(5)
    expect(loc?.text).toContain('/// Model-level doc.')
  })

  it('locates a model-level variant doc line', () => {
    const loc = locateInSchema(SCHEMA, { modelName: 'ModelA', docLine: 2 })
    expect(loc?.line).toBe(6)
    expect(loc?.text).toContain('@nesor-variant')
    expect(loc?.col).toBeGreaterThan(1)
    expect(loc?.underline).toBeDefined()
    expect(loc?.underline?.length).toBe('@nesor-variant'.length)
  })

  it('locates a field-level doc line (1-based)', () => {
    const loc = locateInSchema(SCHEMA, {
      modelName: 'ModelA',
      fieldName: 'name',
      docLine: 2,
    })
    expect(loc?.line).toBe(11)
    expect(loc?.text).toContain('@nesor-exclud')
    expect(loc?.underline?.length).toBe('@nesor-exclud'.length)
  })

  it('returns undefined for an unknown model', () => {
    expect(locateInSchema(SCHEMA, { modelName: 'Ghost' })).toBeUndefined()
  })

  it('returns undefined for an unknown field', () => {
    expect(locateInSchema(SCHEMA, { modelName: 'ModelA', fieldName: 'ghost' })).toBeUndefined()
  })

  it('returns undefined for an out-of-range doc line', () => {
    expect(
      locateInSchema(SCHEMA, { modelName: 'ModelA', fieldName: 'name', docLine: 99 }),
    ).toBeUndefined()
  })
})
