import { NesorError } from './util/diagnostics.js'
import { suggestKey } from './util/levenshtein.js'

export interface NesorConfig {
  output: string
  splitMode: 'perModel' | 'perModule' | 'single'
  fileNameStyle: 'kebab' | 'camel' | 'pascal'
  fileNameSuffix: string
  includeRelations: 'never' | 'optional' | 'required' | 'byVariant'
  includeRelationsCount: boolean
  includeDocs: boolean
  emitMeta: boolean
  metaIncludeExcluded: boolean
  dateType: 'Date' | 'string' | 'number'
  decimalType: 'string' | 'number' | 'Decimal'
  bigIntType: 'bigint' | 'string' | 'number'
  jsonType: 'unknown' | 'any' | 'JsonValue'
  bytesType: string
  enumStrategy: 'inline' | 'reexport' | 'import'
  enumImportFrom: string
  entitySuffix: string
  variantSeparator: string
  metaSuffix: string
  banner: 'default' | 'minimal' | 'none'
  importExtension: string
}

export const DEFAULT_CONFIG: NesorConfig = {
  output: './generated/entities',
  splitMode: 'perModel',
  fileNameStyle: 'kebab',
  fileNameSuffix: '.entity',
  includeRelations: 'never',
  includeRelationsCount: false,
  includeDocs: true,
  emitMeta: true,
  metaIncludeExcluded: true,
  dateType: 'Date',
  decimalType: 'string',
  bigIntType: 'bigint',
  jsonType: 'unknown',
  bytesType: 'Uint8Array',
  enumStrategy: 'inline',
  enumImportFrom: '@prisma/client',
  entitySuffix: 'Entity',
  variantSeparator: '',
  metaSuffix: 'EntityMeta',
  banner: 'default',
  importExtension: '.js',
}

type ConfigKey = keyof NesorConfig

const ENUM_OPTIONS: Partial<Record<ConfigKey, readonly string[]>> = {
  splitMode: ['perModel', 'perModule', 'single'],
  fileNameStyle: ['kebab', 'camel', 'pascal'],
  includeRelations: ['never', 'optional', 'required', 'byVariant'],
  dateType: ['Date', 'string', 'number'],
  decimalType: ['string', 'number', 'Decimal'],
  bigIntType: ['bigint', 'string', 'number'],
  jsonType: ['unknown', 'any', 'JsonValue'],
  enumStrategy: ['inline', 'reexport', 'import'],
  banner: ['default', 'minimal', 'none'],
}

const BOOLEAN_KEYS: ReadonlySet<ConfigKey> = new Set<ConfigKey>([
  'includeRelationsCount',
  'includeDocs',
  'emitMeta',
  'metaIncludeExcluded',
])

const STRING_KEYS: ReadonlySet<ConfigKey> = new Set<ConfigKey>([
  'output',
  'fileNameSuffix',
  'bytesType',
  'enumImportFrom',
  'entitySuffix',
  'variantSeparator',
  'metaSuffix',
  'importExtension',
])

const KNOWN_KEYS: readonly ConfigKey[] = Object.keys(DEFAULT_CONFIG) as ConfigKey[]

function parseBoolean(key: string, value: string): boolean {
  const v = value.toLowerCase()
  if (v === 'true' || v === '1') return true
  if (v === 'false' || v === '0') return false
  throw new NesorError(
    `Generator option "${key}" expects a boolean (true/false) but got "${value}".`,
    'Use true or false in the schema.prisma generator block.',
  )
}

function parseEnum(key: ConfigKey, value: string, options: readonly string[]): string {
  if (options.includes(value)) return value
  const guess = suggestKey(value, options, 3)
  const allowed = options.map((o) => `"${o}"`).join(', ')
  throw new NesorError(
    `Generator option "${key}" must be one of ${allowed}; got "${value}".`,
    guess ? `Did you mean "${guess}"?` : undefined,
  )
}

/** Parse and validate the generator block config. Throws NesorError on any issue. */
export function parseConfig(
  raw: Readonly<Record<string, string | string[] | undefined>>,
): NesorConfig {
  const out: NesorConfig = { ...DEFAULT_CONFIG }

  for (const [rawKey, rawValue] of Object.entries(raw)) {
    if (rawValue === undefined) continue
    if (Array.isArray(rawValue)) {
      throw new NesorError(`Generator option "${rawKey}" is an array; Nesor expects scalar values.`)
    }
    const key = rawKey as ConfigKey
    if (!KNOWN_KEYS.includes(key)) {
      const guess = suggestKey(rawKey, KNOWN_KEYS as readonly string[], 3)
      throw new NesorError(
        `Unknown generator option "${rawKey}".`,
        guess ? `Did you mean "${guess}"? See docs/CONFIG.md.` : 'See docs/CONFIG.md.',
      )
    }
    const target = out as unknown as Record<string, unknown>
    const enumOpts = ENUM_OPTIONS[key]
    if (enumOpts) {
      target[key] = parseEnum(key, rawValue, enumOpts)
    } else if (BOOLEAN_KEYS.has(key)) {
      target[key] = parseBoolean(rawKey, rawValue)
    } else if (STRING_KEYS.has(key)) {
      target[key] = rawValue
    } else {
      throw new NesorError(`Internal: unrouted config key "${rawKey}".`)
    }
  }

  return out
}
