import type { EntityMeta } from 'nesor'

export type { EntityMeta }

export type TransformMap<TRow, TEntity> = {
  [K in keyof TEntity]?: (row: TRow, defaultValue: TEntity[K]) => TEntity[K]
}

export interface BuildMapperOptions<TRow, TEntity> {
  /** Per-field override functions. The default value is the row's source value, after any rename. */
  transform?: TransformMap<TRow, TEntity>
  /** Called once per row after default mapping and overrides. Return the entity (possibly modified). */
  afterMap?: (entity: TEntity, row: TRow) => TEntity
}

/**
 * Build a row-to-entity mapper from an EntityMeta. Honours field renames and
 * lets the caller supply per-field transforms. Excluded fields are never read
 * from the row. Brand casts are TS-level only.
 */
export function buildMapper<TRow, TEntity>(
  meta: EntityMeta,
  options: BuildMapperOptions<TRow, TEntity> = {},
): (row: TRow) => TEntity {
  const entries = Object.entries(meta.fields)
  const transform = options.transform
  const afterMap = options.afterMap

  return (row: TRow): TEntity => {
    const entity = {} as Record<string, unknown>
    for (const [outKey, info] of entries) {
      const source = info.source
      const defaultValue = (row as Record<string, unknown>)[source]
      const override = (transform as Record<string, unknown> | undefined)?.[outKey] as
        | ((row: TRow, def: unknown) => unknown)
        | undefined
      entity[outKey] = override ? override(row, defaultValue) : defaultValue
    }
    if (afterMap) return afterMap(entity as TEntity, row)
    return entity as TEntity
  }
}

/** Build a mapper that operates on an array of rows. Convenience around buildMapper. */
export function buildArrayMapper<TRow, TEntity>(
  meta: EntityMeta,
  options: BuildMapperOptions<TRow, TEntity> = {},
): (rows: readonly TRow[]) => TEntity[] {
  const one = buildMapper(meta, options)
  return (rows) => rows.map(one)
}
