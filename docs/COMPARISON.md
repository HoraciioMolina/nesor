# Comparison

A neutral feature comparison. Use whichever tool fits your project.

|  | nesor | prisma-generator-typescript-interfaces | prisma-class-generator | prisma-class-validator-generator | tRPC's built-in inference |
| --- | :-: | :-: | :-: | :-: | :-: |
| One file per model | ✅ | ❌ | ✅ | ✅ | n/a |
| One file per module / subfolder | ✅ | ❌ | ❌ | ❌ | n/a |
| Doc-comment driven exclude / rename / brand | ✅ | partial | ❌ | partial | ❌ |
| Variants (multiple shapes per model) | ✅ | ❌ | ❌ | ❌ | n/a |
| Static `EntityMeta` const | ✅ | ❌ | ❌ | ❌ | n/a |
| Cyclic-import-safe relations | ✅ | partial | ❌ | ❌ | n/a |
| Zero runtime deps in emitted code | ✅ | ✅ | ❌ (class-validator) | ❌ | n/a |
| Interfaces (not classes / decorators) | ✅ | ✅ | ❌ | ❌ | n/a |
| Schema-side configuration only | ✅ | ✅ | partial | partial | n/a |

## When NOT to use Nesor

- You want runtime validation (Zod schemas, class-validator decorators). That is a different scope. Use `prisma-zod-generator` or a class-based generator alongside Nesor.
- You want DTOs annotated for OpenAPI / Swagger. Generate those separately and keep them hand-curated.
- You want repositories, services, or controllers generated. Out of scope — Nesor only emits entity types and inert metadata.

## Design tenets that differ from some alternatives

- **No business logic in emitted code.** Mapping is the consumer's job. The optional `@nesor/mapper` is opt-in and explicit.
- **No assumed conventions.** Nesor has no built-in knowledge of field names like `email`, `password`, or `createdAt`. Behaviour is driven entirely by your `///` tags.
- **Output is committed to git.** Diff review is the safety net; output is deterministic and formatter-friendly.
