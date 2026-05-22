import type { EntityMeta } from 'nesor'
import { describe, expect, it } from 'vitest'
import { buildArrayMapper, buildMapper } from '../../src/index.js'

interface RowA {
  id: string
  name: string
  count: number
  createdAt: Date
  apiKey: string
}

interface EntityA {
  id: string
  name: string
  count: number
  createdAtIso: Date
}

const metaA: EntityMeta = {
  prismaModel: 'ModelA',
  entityName: 'ModelAEntity',
  fields: {
    id: { source: 'id', kind: 'scalar', tsType: 'string' },
    name: { source: 'name', kind: 'scalar', tsType: 'string' },
    count: { source: 'count', kind: 'scalar', tsType: 'number' },
    createdAtIso: {
      source: 'createdAt',
      kind: 'scalar',
      tsType: 'Date',
      renamedFrom: 'createdAt',
    },
  },
  excluded: ['apiKey'],
  secrets: ['apiKey'],
  variants: {},
}

describe('buildMapper', () => {
  it('maps a row to an entity using fields declared in meta', () => {
    const toEntity = buildMapper<RowA, EntityA>(metaA)
    const row: RowA = {
      id: 'i-1',
      name: 'alpha',
      count: 7,
      createdAt: new Date('2026-05-20T00:00:00Z'),
      apiKey: 'secret-do-not-leak',
    }
    const entity = toEntity(row)
    expect(entity.id).toBe('i-1')
    expect(entity.name).toBe('alpha')
    expect(entity.count).toBe(7)
    expect(entity.createdAtIso.toISOString()).toBe('2026-05-20T00:00:00.000Z')
  })

  it('never reads excluded fields from the row', () => {
    const toEntity = buildMapper<RowA, EntityA>(metaA)
    const row: RowA = {
      id: 'i-1',
      name: 'alpha',
      count: 1,
      createdAt: new Date(),
      apiKey: 'should-not-appear',
    }
    const entity = toEntity(row) as unknown as Record<string, unknown>
    expect(Object.keys(entity)).toEqual(['id', 'name', 'count', 'createdAtIso'])
    expect('apiKey' in entity).toBe(false)
  })

  it('applies a transform override and exposes the default value', () => {
    const toEntity = buildMapper<RowA, EntityA>(metaA, {
      transform: {
        count: (row, def) => def + row.count, // double via the default value
        name: (row) => row.name.toUpperCase(),
      },
    })
    const row: RowA = {
      id: 'i-1',
      name: 'alpha',
      count: 3,
      createdAt: new Date(),
      apiKey: '',
    }
    const entity = toEntity(row)
    expect(entity.count).toBe(6)
    expect(entity.name).toBe('ALPHA')
  })

  it('runs afterMap after defaults and overrides', () => {
    const toEntity = buildMapper<RowA, EntityA>(metaA, {
      afterMap: (entity, row) => ({ ...entity, name: `${row.name}-suffix` }),
    })
    const row: RowA = {
      id: 'i-1',
      name: 'alpha',
      count: 1,
      createdAt: new Date(),
      apiKey: '',
    }
    const entity = toEntity(row)
    expect(entity.name).toBe('alpha-suffix')
  })

  it('honors renames (renamedFrom)', () => {
    const toEntity = buildMapper<RowA, EntityA>(metaA)
    const created = new Date('2026-01-01')
    const entity = toEntity({ id: '', name: '', count: 0, createdAt: created, apiKey: '' })
    expect(entity.createdAtIso).toBe(created)
  })
})

describe('buildArrayMapper', () => {
  it('maps an array of rows', () => {
    const toEntities = buildArrayMapper<RowA, EntityA>(metaA)
    const rows: RowA[] = [
      { id: 'a', name: 'one', count: 1, createdAt: new Date(0), apiKey: '' },
      { id: 'b', name: 'two', count: 2, createdAt: new Date(0), apiKey: '' },
    ]
    const entities = toEntities(rows)
    expect(entities).toHaveLength(2)
    expect(entities[0]?.name).toBe('one')
    expect(entities[1]?.name).toBe('two')
  })
})
