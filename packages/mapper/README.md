<p align="center">
  <a href="https://github.com/HoraciioMolina/nesor">
    <img src="https://raw.githubusercontent.com/HoraciioMolina/nesor/main/assets/banner.svg" alt="Nesor — Prisma to clean TypeScript domain entities" width="100%"/>
  </a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@nesor/mapper"><img src="https://img.shields.io/npm/v/@nesor/mapper.svg?label=npm&color=2563EB" alt="npm version"/></a>
  <a href="https://www.npmjs.com/package/@nesor/mapper"><img src="https://img.shields.io/npm/dm/@nesor/mapper.svg?label=downloads&color=8B5CF6" alt="downloads/month"/></a>
  <a href="https://github.com/HoraciioMolina/nesor/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@nesor/mapper.svg?label=license&color=0EA5E9" alt="license"/></a>
</p>

# @nesor/mapper

A ~30-LOC runtime helper that turns a Prisma row into a [Nesor](https://www.npmjs.com/package/nesor)-generated entity using the static `EntityMeta` the generator emits. Opt-in. Designed for the trivial 80% of cases — field renames, exclusions, brand casts. For anything beyond that, write your own mapper.

## Install

```sh
pnpm add @nesor/mapper
```

Peer-deps on `nesor` (the generator). If you don't already have it, see the [nesor README](https://www.npmjs.com/package/nesor).

## Three usage levels

Pick the lowest one that does what you need.

### Level 0 — hand-roll

```
import type { ModelAEntity } from '@/generated/entities/model-a.entity.js'

export function toModelAEntity(row: ModelARow): ModelAEntity {
  return { /* ... */ }
}
```

### Level 1 — buildMapper

```
import { buildMapper } from '@nesor/mapper'
import { ModelAEntityMeta, type ModelAEntity } from '@/generated/entities/model-a.entity.js'

export const toModelAEntity = buildMapper<ModelARow, ModelAEntity>(ModelAEntityMeta)
```

### Level 2 — buildMapper + transforms

```
export const toModelAEntity = buildMapper<ModelARow, ModelAEntity>(ModelAEntityMeta, {
  transform: {
    count: (row, def) => def * 100,
  },
  afterMap: (entity, row) => ({ ...entity, displayName: row.name.toUpperCase() }),
})
```

Plus `buildArrayMapper<TRow, TEntity>(meta, options?)` for batch mapping.

## What this is not

Not a domain modeller, not a `Decimal` parser, not a JSON validator. See [MAPPER.md](https://github.com/HoraciioMolina/nesor/blob/main/docs/MAPPER.md) for the full guide and limitations.

## Publishing

This package lives in a pnpm workspace and declares its peer dep on `nesor` as `workspace:^`. Only `pnpm publish` rewrites that specifier to a concrete version before packing — `npm publish` would ship the literal string and break installs. Always publish via `pnpm publish` (or the monorepo's `pnpm release` script). A `prepublishOnly` guard aborts the publish if it detects non-pnpm tooling.

## License

MIT
