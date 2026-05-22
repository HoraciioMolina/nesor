import { describe, expect, it } from 'vitest'
import { toFileBaseName } from '../../../src/util/naming.js'

describe('toFileBaseName', () => {
  it('converts PascalCase to kebab', () => {
    expect(toFileBaseName('ModelAlpha', 'kebab')).toBe('model-alpha')
    expect(toFileBaseName('ABCWord', 'kebab')).toBe('abc-word')
  })

  it('converts PascalCase to camel', () => {
    expect(toFileBaseName('ModelAlpha', 'camel')).toBe('modelAlpha')
  })

  it('passes PascalCase through pascal', () => {
    expect(toFileBaseName('ModelAlpha', 'pascal')).toBe('ModelAlpha')
  })

  it('handles snake_case input', () => {
    expect(toFileBaseName('model_alpha', 'pascal')).toBe('ModelAlpha')
    expect(toFileBaseName('model_alpha', 'kebab')).toBe('model-alpha')
  })
})
