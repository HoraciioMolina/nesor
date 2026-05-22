# Architecture

Internal layout of the `nesor` generator. Read this if you want to extend the generator or land a non-trivial change.

## Module layout

```
packages/generator/src/
├── bin.ts                  # dispatch: Prisma generator IPC vs CLI
├── index.ts                # registers the @prisma/generator-helper handler
├── run.ts                  # orchestrator (parseConfig + walk + emit + write)
├── config.ts               # NesorConfig + parseConfig (Levenshtein-hinted errors)
├── types.ts                # public types: EntityMeta, FieldInfo, VariantInfo
├── cli/
│   ├── index.ts            # subcommand dispatch + parseFlags + help
│   ├── init.ts             # `nesor init`  — appends a generator block
│   ├── watch.ts            # `nesor watch` — fs.watch + debounced regenerate
│   ├── check.ts            # `nesor check` — hash before/after, exit on drift
│   └── run-prisma.ts       # shared `spawn npx prisma generate` helper
├── dmmf/
│   └── walker.ts           # DMMF.Document → WalkedSchema (normalized)
├── parse/                  # /// @nesor-* DSL — one file per responsibility
│   ├── dsl.ts              # barrel: re-exports the public API
│   ├── tags.ts             # types + tag-name constants + describe()
│   ├── tokenize.ts         # line tokenizer + identifier list + unknown-tag rejection
│   ├── field.ts            # parseFieldDocs
│   └── model.ts            # parseModelDocs + variant args parser
├── variants/
│   ├── resolver.ts         # WalkedModel → ResolvedModel (orchestrator)
│   ├── types.ts            # ResolvedField / ResolvedVariant / ResolvedModel / VariantDecl
│   ├── identity.ts         # entityBaseOf + computeOutputBase + module routing
│   ├── fields.ts           # resolveScalarField / resolveRelationField / isExcludedByDsl
│   └── validate.ts         # declaredVariants + reference validation
├── emit/                   # ResolvedModel(s) → text
│   ├── file.ts             # per-model file orchestration
│   ├── single.ts           # splitMode=single orchestration
│   ├── meta.ts             # EntityMeta literal printer
│   ├── declarations.ts     # interfaces, brand decls, JSDoc
│   ├── imports.ts          # enum imports + relation import path math
│   ├── banner.ts           # the //╔═╗ header
│   ├── scalars.ts          # Prisma scalar/enum → TS type mapping
│   └── types.ts            # EmittedFile
└── util/
    ├── diagnostics.ts      # NesorError + formatError
    ├── levenshtein.ts      # edit distance + suggestKey
    ├── naming.ts           # toFileBaseName
    └── quote.ts            # smart TS string-literal quoting
```

## Data flow

```
schema.prisma
   │
   ▼ (Prisma)
DMMF.Document
   │
   ▼ (dmmf/walker.ts)
WalkedSchema   ─── parse/* runs inside walker on each doc string
   │
   ▼ (variants/resolver.ts, per model)
ResolvedModel  ─── identity.ts (paths), fields.ts (types), validate.ts (errors)
   │
   ▼ (emit/file.ts or emit/single.ts)
EmittedFile { path, text }
   │
   ▼ (run.ts)
disk
```

Each step has a single owner; tests cover each in isolation. The emitter never reads DMMF directly, and the resolver never builds strings — boundaries match the folder layout.

## ts-morph deviation

The original spec calls for `ts-morph` to build the emitted TS. The current implementation produces text directly via a few small helpers in `emit/declarations.ts`, `emit/meta.ts`, `emit/imports.ts`. Why:

- **Determinism is already achieved.** Sorted iteration + idempotent helpers + no timestamps gives byte-identical output across runs (verified by the golden fixtures and `nesor check`).
- **Formatter-friendly output.** The `util/quote.ts` helper switches between single and double quotes so Biome / Prettier do not want to reflow the file.
- **Tiny surface.** The emit modules total ~250 LOC and read like a templating layer. A ts-morph-based version would add a dependency on `ts-morph` (~2 MB) and several more layers of AST construction for the same observable output.
- **Easy to swap.** All emission happens through the modules under `emit/`. Swapping to ts-morph is local: rewrite `emit/declarations.ts`, `emit/meta.ts`, and `emit/imports.ts` against the ts-morph SourceFile API. The orchestrators (`emit/file.ts`, `emit/single.ts`) and everything upstream stay the same.

If a future feature stresses the current approach — for example, generating multiple complex import graphs or interacting with TS source positions — switching to ts-morph remains a clean follow-up.

## Output guarantees

- Iteration follows DMMF declaration order (Prisma already sorts fields by source position).
- No timestamps, hashes, or environment-dependent values are written.
- Brand declarations are deduplicated per file via `state.brands` (resolver) / `collectBrandsAcross` (single mode).
- Enum imports are deduplicated and sorted.
- Relation imports are sorted by entity name.
- Self-imports are removed in `resolveModel` after collecting relation imports.

These invariants are checked by:
- `test/golden/**` — byte-for-byte snapshots.
- `test/unit/emit/file.spec.ts` — idempotency test runs the emitter twice.
- The committed `examples/express-postgres/src/generated/entities/*` — real-DMMF round trip; `nesor check` is meant to fail in CI if these drift.
