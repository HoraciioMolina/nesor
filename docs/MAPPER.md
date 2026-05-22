# @nesor/mapper

A 30-LOC helper for mapping a Prisma row to a Nesor entity. Opt-in: install only if you want it, and only for the cases where it pays.

## When to use it

Use it when your mapping is one of:

- copy known fields by name,
- honour `@nesor-rename` (the helper reads `source` from the meta),
- skip `@nesor-exclude` / `@nesor-secret` fields,
- apply a small per-field transform.

If you need more — domain-specific construction, multi-source mapping, JSON shape coercion, decimal parsing — write your own function. The helper is not a domain modeller.

## Install

```sh
pnpm add @nesor/mapper
```

`nesor` is a peer dependency.

## Three usage levels

### Level 0 — hand-roll

Nothing wrong with this. The entity type guides you, the linter catches typos.

```ts
import type { ModelAEntity } from '@/generated/entities/model-a.entity.js'

export function toModelAEntity(row: ModelARow): ModelAEntity {
  return {
    id: row.id,
    name: row.name,
    count: row.count,
    createdAtIso: row.createdAt,
  }
}
```

### Level 1 — buildMapper

```ts
import { buildMapper } from '@nesor/mapper'
import { ModelAEntityMeta, type ModelAEntity } from '@/generated/entities/model-a.entity.js'

export const toModelAEntity = buildMapper<ModelARow, ModelAEntity>(ModelAEntityMeta)
```

The mapper:

- copies every key listed in `meta.fields` by reading `row[FieldInfo.source]`,
- writes it under the rename target (e.g. `createdAtIso` ← `createdAt`),
- never reads excluded or secret fields.

### Level 2 — buildMapper + transforms

```ts
export const toModelAEntity = buildMapper<ModelARow, ModelAEntity>(ModelAEntityMeta, {
  transform: {
    createdAtIso: (row) => new Date(row.createdAt.toISOString().slice(0, 19)),
    count: (row, def) => def * 100,
  },
  afterMap: (entity, row) => ({ ...entity, displayName: row.name.toUpperCase() }),
})
```

Each `transform[outKey]` receives the raw row and the default value (the value that would be assigned without the transform). `afterMap` runs once per row after everything else.

## buildArrayMapper

```ts
export const toModelAEntities = buildArrayMapper<ModelARow, ModelAEntity>(ModelAEntityMeta)
const entities = toModelAEntities(await prisma.modelA.findMany())
```

Same options as `buildMapper`.

## What this helper does NOT do

- It does not parse Decimal columns. Use `decimal.js` or similar in a transform.
- It does not normalise email, lowercase strings, or coerce dates.
- It does not validate JSON. Use Zod (or similar) outside of this helper.
- It is not aware of relations. If your row carries a related entity, write the assembly by hand or use the transform hook.
