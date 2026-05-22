# express-postgres example

Minimal end-to-end consumer of `nesor` (the generator) and `@nesor/mapper` (the optional helper).

The `prisma/schema.prisma` declares two visible models and one skipped model. Running `pnpm prisma generate` writes typed entity files into `src/generated/entities/`, which are committed.

## Run locally

```sh
pnpm install
pnpm --filter @nesor-examples/express-postgres generate
```

You do **not** need a running database — Nesor only reads the schema, never the connection.

## What this demonstrates

- One file per model.
- `@nesor-rename` to project a different field name into the entity.
- `@nesor-exclude` to drop a field entirely.
- `@nesor-secret` to drop a field **and** record it under `EntityMeta.secrets[]`.
- `@nesor-skip` to omit a whole model.
- Inline enum unions.
- `EntityMeta` as an inert `as const` data object suitable for downstream tooling.
