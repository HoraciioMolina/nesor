import { describe, expect, it } from 'vitest'
import { levenshtein, suggestKey } from '../../src/util/levenshtein.js'

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('abc', 'abc')).toBe(0)
  })

  it('returns full length when one side is empty', () => {
    expect(levenshtein('', 'abc')).toBe(3)
    expect(levenshtein('abc', '')).toBe(3)
  })

  it('handles single substitution', () => {
    expect(levenshtein('abc', 'abd')).toBe(1)
  })

  it('handles insertion and deletion', () => {
    expect(levenshtein('abc', 'abcd')).toBe(1)
    expect(levenshtein('abcd', 'abc')).toBe(1)
  })
})

describe('suggestKey', () => {
  it('returns the closest candidate within maxDistance', () => {
    expect(suggestKey('splitMod', ['splitMode', 'emitMeta'], 3)).toBe('splitMode')
  })

  it('returns undefined when nothing is close enough', () => {
    expect(suggestKey('zzzzz', ['splitMode', 'emitMeta'], 2)).toBeUndefined()
  })

  it('returns undefined for an empty candidate list', () => {
    expect(suggestKey('foo', [])).toBeUndefined()
  })
})
