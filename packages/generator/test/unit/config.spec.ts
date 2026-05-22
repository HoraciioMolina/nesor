import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, parseConfig } from '../../src/config.js'
import { NesorError } from '../../src/util/diagnostics.js'

describe('parseConfig', () => {
  it('returns defaults when no overrides are provided', () => {
    expect(parseConfig({})).toEqual(DEFAULT_CONFIG)
  })

  it('applies a single enum override', () => {
    const cfg = parseConfig({ splitMode: 'single' })
    expect(cfg.splitMode).toBe('single')
  })

  it('parses boolean strings', () => {
    const cfg = parseConfig({ emitMeta: 'false', includeDocs: 'true' })
    expect(cfg.emitMeta).toBe(false)
    expect(cfg.includeDocs).toBe(true)
  })

  it('rejects unknown keys with a Levenshtein suggestion', () => {
    try {
      parseConfig({ splitMod: 'perModel' })
      throw new Error('expected to throw')
    } catch (err) {
      expect(err).toBeInstanceOf(NesorError)
      const ne = err as NesorError
      expect(ne.message).toContain('Unknown generator option "splitMod"')
      expect(ne.hint).toContain('splitMode')
    }
  })

  it('rejects invalid enum values with a hint', () => {
    try {
      parseConfig({ splitMode: 'singel' })
      throw new Error('expected to throw')
    } catch (err) {
      expect(err).toBeInstanceOf(NesorError)
      const ne = err as NesorError
      expect(ne.message).toContain('splitMode')
      expect(ne.hint).toContain('single')
    }
  })

  it('rejects malformed booleans', () => {
    expect(() => parseConfig({ emitMeta: 'maybe' })).toThrow(NesorError)
  })

  it('rejects array values', () => {
    expect(() => parseConfig({ output: ['a', 'b'] })).toThrow(NesorError)
  })

  it('passes string-typed options through verbatim', () => {
    const cfg = parseConfig({
      output: '../entities',
      entitySuffix: 'DTO',
      enumImportFrom: './enums.js',
    })
    expect(cfg.output).toBe('../entities')
    expect(cfg.entitySuffix).toBe('DTO')
    expect(cfg.enumImportFrom).toBe('./enums.js')
  })
})
