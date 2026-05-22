# EntityMeta

Every entity file ships a `<Model>EntityMeta` const. It is inert data: no methods, no side effects, no runtime logic. Nesor never asks consumers to import a helper to read it.

## Shape

```ts
import type { EntityMeta } from 'nesor'

export interface EntityMeta {
  prismaModel: string
  entityName: string
  fields: Readonly<Record<string, FieldInfo>>
  excluded: readonly string[]
  secrets: readonly string[]
  variants: Readonly<Record<string, VariantInfo>>
}

export interface FieldInfo {
  source: string
  kind: 'scalar' | 'enum' | 'relation'
  tsType: string
  nullable?: true
  list?: true
  brand?: string
  readonly?: true
  renamedFrom?: string
}

export interface VariantInfo {
  include?: readonly string[]
  exclude?: readonly string[]
  withRelations?: readonly string[]
}
```

The emitted const is declared `as const`, so consumers get literal types — `kind: 'scalar'` rather than `kind: string`.

## Consuming it directly

```ts
import { ModelAEntityMeta } from '@/generated/entities/model-a.entity.js'

// Iterate over the projection columns
const columns = Object.values(ModelAEntityMeta.fields).map((f) => f.source)

// Detect a secret on a generic logging path
function isSecret(fieldName: string): boolean {
  return ModelAEntityMeta.secrets.includes(fieldName)
}
```

## Use with @nesor/mapper

[@nesor/mapper](./MAPPER.md) wraps `EntityMeta` into a row → entity function for the trivial 80% of cases. See that doc for the three usage levels.

## What EntityMeta does NOT carry

Nesor never invents semantics. Meta does not know which fields are PII, which need normalising, or how to parse a Decimal — that is your domain's responsibility. Meta only states what the schema and the DSL tags said.
