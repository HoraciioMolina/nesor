# Contributing to Nesor

## Setup

```sh
pnpm install
pnpm -r build
pnpm -r test
```

## Project layout

This is a pnpm workspace.

- `packages/generator` — the published `nesor` Prisma generator.
- `packages/mapper` — the optional `@nesor/mapper` runtime helper.

## Fixture / golden workflow

Generator output is verified by byte-for-byte comparison against committed golden files.

- Fixtures: `packages/generator/test/fixtures/<name>/schema.prisma`
- Goldens: `packages/generator/test/golden/<name>/`
- Update goldens after an intentional change: `UPDATE_SNAPSHOTS=1 pnpm -r test`

Treat golden diffs like API diffs. Review each line.

## Commits

Conventional Commits required: `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`. One commit per logical change. No emojis.

## Changesets

Every user-facing change needs a changeset:

```sh
pnpm changeset
```

Pre-1.0: `minor` for breaking changes, `patch` for additive.

## Publishing

Always publish through pnpm. The CI release flow uses `pnpm release` (changesets → `pnpm publish`); for an emergency manual publish, `cd` into the package and run `pnpm publish --access public`. Never use `npm publish` — `@nesor/mapper` declares its peer on `nesor` as `workspace:^`, and only pnpm rewrites that specifier to a concrete version before packing. Each package has a `prepublishOnly` guard that aborts if non-pnpm tooling is detected.

## Naming in tests and fixtures

Avoid real-world identifiers (`User`, `Post`, `email`, `password`). Use abstract placeholders (`ModelA`, `fieldX`, `BrandY`) — Nesor is name-agnostic and tests should prove it.
