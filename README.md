<p align="center">
  <a href="https://github.com/HoraciioMolina/nesor">
    <img src="./assets/banner.svg" alt="Nesor — Prisma to clean TypeScript domain entities" width="100%"/>
  </a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/nesor"><img src="https://img.shields.io/npm/v/nesor.svg?label=nesor&color=2563EB" alt="nesor on npm"/></a>
  <a href="https://www.npmjs.com/package/@nesor/mapper"><img src="https://img.shields.io/npm/v/@nesor/mapper.svg?label=%40nesor%2Fmapper&color=8B5CF6" alt="@nesor/mapper on npm"/></a>
  <a href="https://github.com/HoraciioMolina/nesor/blob/main/LICENSE"><img src="https://img.shields.io/github/license/HoraciioMolina/nesor.svg?color=0EA5E9" alt="license"/></a>
  <img src="https://img.shields.io/badge/node-%E2%89%A520-10B981" alt="node ≥20"/>
  <img src="https://img.shields.io/badge/prisma-6.x-3982CE" alt="prisma 6.x"/>
</p>

# Nesor

Generate clean, modular TypeScript domain entities from your Prisma schema. **One file per model**, doc-comment-driven exclusion, variants, branded IDs, and static metadata for your own mappers. Prisma comes bundled.

```prisma
/// @nesor-variant Compact include=id,name
model ModelA {
  /// @nesor-brand ModelAId
  id     String   @id
  name   String
  count  Int
  /// @nesor-secret
  apiKey String
}
```

After `pnpm nesor generate`:

```
export type ModelAId = string & { readonly __brand: 'ModelAId' }
export interface ModelAEntity { id: ModelAId; name: string; count: number }
export interface ModelACompactEntity { id: ModelAId; name: string }
export const ModelAEntityMeta = { /* inert metadata, including secrets[] */ } as const
```

## Quick start

```sh
pnpm add -D nesor
pnpm nesor init       # bootstraps prisma/schema.prisma + adds the nesor block
pnpm nesor generate   # writes one <model>.entity.ts per model
```

Three commands, zero to entities. The full Prisma CLI is reachable through `nesor` (`nesor migrate dev`, `nesor studio`, `nesor format`, `nesor db pull`, …).

## Packages

This is a pnpm workspace. The published packages are:

| Package | Purpose | npm |
| --- | --- | --- |
| [`nesor`](./packages/generator) | the Prisma generator | [![nesor](https://img.shields.io/npm/v/nesor.svg)](https://www.npmjs.com/package/nesor) |
| [`@nesor/mapper`](./packages/mapper) | optional, zero-opinion row-to-entity helper | [![@nesor/mapper](https://img.shields.io/npm/v/@nesor/mapper.svg)](https://www.npmjs.com/package/@nesor/mapper) |

## Docs

- [CONFIG](./docs/CONFIG.md) — generator block options.
- [DSL](./docs/DSL.md) — `///` tag reference.
- [VARIANTS](./docs/VARIANTS.md) — variant declaration and consumption.
- [META](./docs/META.md) — `EntityMeta` shape.
- [MAPPER](./docs/MAPPER.md) — `@nesor/mapper` usage levels.
- [RECIPES](./docs/RECIPES.md) — clean architecture, soft delete, branded IDs, modules.
- [COMPARISON](./docs/COMPARISON.md) — vs other Prisma → TS generators.
- [ARCHITECTURE](./docs/ARCHITECTURE.md) — how the generator is wired internally.

## Example

[`examples/express-postgres/`](./examples/express-postgres/) shows a working schema with branded IDs, a `Compact` variant, a `WithChildren` variant, a sibling model, and a mapping module exercising the three `@nesor/mapper` usage levels.

## Status

Pre-1.0 — API may still change. See [CHANGELOG.md](./CHANGELOG.md) for releases (managed via [Changesets](https://github.com/changesets/changesets)).

## Contributing

Read [CONTRIBUTING.md](./CONTRIBUTING.md). Conventional Commits; tests must stay green; generated files in `examples/express-postgres/src/generated` are part of the diff review.

## License

[MIT](./LICENSE) © Horacio Molina
