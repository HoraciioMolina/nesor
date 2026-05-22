# CONFIG

Reference for every option of the `generator nesor { ... }` block in your `schema.prisma`.

## Example

```prisma
generator nesor {
  provider          = "nesor"
  output            = "../src/generated/entities"
  splitMode         = "perModule"
  includeRelations  = "byVariant"
  enumStrategy      = "inline"
  banner            = "default"
}
```

Unknown keys raise an error with a Levenshtein-suggested correction.

## File layout

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `output` | path | `./generated/entities` | Output directory. Resolved relative to `schema.prisma`. |
| `splitMode` | `perModel` \| `perModule` \| `single` | `perModel` | One file per model, group by `@nesor-module`, or one mega-file. Phase 5 ships `perModel` + `perModule`. |
| `fileNameStyle` | `kebab` \| `camel` \| `pascal` | `kebab` | Casing of the emitted file base name. |
| `fileNameSuffix` | string | `.entity` | Suffix appended to the base name (file ends in `.entity.ts` by default). |

## Content

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `includeRelations` | `never` \| `optional` \| `required` \| `byVariant` | `never` | How relation fields appear in the default interface. `byVariant` excludes them by default; only variants with `withRelations=` get them. |
| `includeRelationsCount` | boolean | `false` | Reserved. Currently a no-op. |
| `includeDocs` | boolean | `true` | Copy non-DSL `///` doc lines into JSDoc on the emitted interface. |

## Metadata

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `emitMeta` | boolean | `true` | Emit the `<Model>EntityMeta` const alongside the interface. |
| `metaIncludeExcluded` | boolean | `true` | Include `excluded[]` in the meta. Disable to omit excluded names entirely. |

## Type mapping

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `dateType` | `Date` \| `string` \| `number` | `Date` | TS type for `DateTime` columns. |
| `decimalType` | `string` \| `number` \| `Decimal` | `string` | TS type for `Decimal` columns. With `string`, Nesor emits an advisory JSDoc on each Decimal field. With `Decimal`, Nesor auto-emits `import type { Decimal } from '@prisma/client/runtime/library'` in any file that uses it; `@prisma/client` must be installed. Do not declare `@nesor-brand Decimal` in the same schema — the names collide and Nesor will refuse to generate. |
| `bigIntType` | `bigint` \| `string` \| `number` | `bigint` | TS type for `BigInt` columns. |
| `jsonType` | `unknown` \| `any` \| `JsonValue` | `unknown` | TS type for `Json` columns. With `JsonValue`, the consumer is responsible for declaring or importing that name. |
| `bytesType` | string | `Uint8Array` | TS type for `Bytes` columns. |
| `enumStrategy` | `inline` \| `reexport` \| `import` | `inline` | Inline union (`'A' \| 'B'`), or import the enum from `enumImportFrom`. `reexport` also re-exports the enum from the entity file. |
| `enumImportFrom` | string | `@prisma/client` | Source for non-inline enum strategies. |

## Naming

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `entitySuffix` | string | `Entity` | Appended to the model name to form the interface (`ModelA` → `ModelAEntity`). |
| `variantSeparator` | string | `""` | Sits between the entity base and the variant name. `ModelACompactEntity` by default. |
| `metaSuffix` | string | `EntityMeta` | Appended to the model name to form the meta const (`ModelA` → `ModelAEntityMeta`). |

## Tooling

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `banner` | `default` \| `minimal` \| `none` | `default` | Header comment block at the top of every emitted file. |
| `importExtension` | string | `.js` | Extension on emitted import paths. NodeNext consumers usually want `.js`; bundlers can use `""`. |
