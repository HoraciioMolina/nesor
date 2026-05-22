# Variants

A variant is a second projection of the same Prisma model — a different shape your code base wants to talk about. The schema is the source of truth; Nesor turns each declared variant into an additional `interface`.

## Declaring a variant

Variants are declared with the `@nesor-variant` model tag:

```prisma
/// @nesor-variant Compact include=id,name
/// @nesor-variant WithChildren withRelations=children
model ModelA {
  id       String   @id
  name     String
  count    Int
  children ModelB[]
}
```

Each variant has a name (PascalCase by convention) and one or more selection keys:

- `include=` — only the listed fields. Standalone interface.
- `exclude=` — every default field except the listed ones. Standalone interface.
- `withRelations=` — the default fields, plus the listed relations. Emitted as `interface ModelAWithChildrenEntity extends ModelAEntity { children: ... }` when nothing else modifies the base.

`include=` and `exclude=` are mutually exclusive. At least one selection key is required.

## Field-level overrides

```prisma
model ModelA {
  /// @nesor-exclude-from Compact
  volatile String

  /// @nesor-exclude
  /// @nesor-include-in Audit
  internalNote String
}
```

- `@nesor-exclude-from` drops a field from specific variants while keeping it in the default.
- `@nesor-include-in` re-introduces an excluded field in a specific variant — useful for an `Audit` variant that surfaces what the default hides.

## How a variant resolves

```mermaid
flowchart TD
    A[Model fields] --> B{Variant<br/>declared with}
    B -->|include=| C[Standalone interface<br/>only listed fields]
    B -->|exclude=| D[Standalone interface<br/>default minus listed]
    B -->|withRelations= only| E[extends DefaultEntity<br/>adds listed relations]
    A --> F[Field tags]
    F -->|@nesor-exclude-from V| G[Drop from variant V<br/>after base selection]
    F -->|@nesor-include-in V| H[Force include in V<br/>even if @nesor-exclude]
    C --> I[ModelACompactEntity]
    D --> I
    E --> J[ModelAWithChildrenEntity extends ModelAEntity]
    G --> I
    H --> I
```

The `extends` form only appears when the variant is purely additive over the default — `withRelations=` and nothing else mutates the base set.

## Output shape

For the example above (`Compact` and `WithChildren`) Nesor emits:

```ts
export interface ModelAEntity { id: ...; name: ...; count: ...; }
export interface ModelACompactEntity { id: ...; name: ...; }
export interface ModelAWithChildrenEntity extends ModelAEntity { children: ModelBEntity[]; }
```

The `extends` form only appears when the variant is purely additive over the default (just `withRelations=`, no overrides applied). Anything more nuanced is a standalone interface.

## EntityMeta.variants

Every declared variant is recorded in the meta const:

```ts
export const ModelAEntityMeta = {
  // ...
  variants: {
    Compact:      { include: ['id', 'name'] },
    WithChildren: { withRelations: ['children'] },
  },
} as const
```

Consumers can program against `variants` if they need runtime knowledge of the projections.
