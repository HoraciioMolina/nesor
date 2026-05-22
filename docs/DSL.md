# DSL

Reference for `/// @nesor-*` doc-comment tags. They are parsed from the doc text Prisma carries on each model and field.

## Where tags go

```prisma
/// Plain prose lines become JSDoc on the entity.
/// @nesor-variant Compact include=id,name
model ModelA {
  /// @nesor-brand UserId
  id    String @id
  /// @nesor-rename createdAtIso
  /// @nesor-exclude-from Compact
  createdAt DateTime
}
```

A line that does not start with `@nesor-` is kept as JSDoc description (when `includeDocs = true`).

Unknown `@nesor-*` tag names produce a hard error with a Levenshtein suggestion.

## Field tags

| Tag | Args | Effect |
| --- | --- | --- |
| `@nesor-exclude` | (none) | Field is omitted from every emitted interface. Recorded in `EntityMeta.excluded`. |
| `@nesor-rename <newName>` | identifier | Emit the field under `newName`. Source still tracked under `EntityMeta.fields.<newName>.renamedFrom`. |
| `@nesor-secret` | (none) | Shorthand for `@nesor-exclude` plus recording the field in `EntityMeta.secrets[]`. |
| `@nesor-exclude-from <V1>,<V2>...` | comma list | Drop the field from the listed variants while keeping it in the default. |
| `@nesor-include-in <V1>,<V2>...` | comma list | Force-include an `@nesor-exclude`d field in the listed variants. Cannot combine with `@nesor-secret`. |
| `@nesor-brand <Name>` | identifier | Emit as `<Name> = <base> & { readonly __brand: '<Name>' }` and use `<Name>` for the field's type. The brand declaration is hoisted to the top of the file and emitted only once. |

## Model tags

| Tag | Args | Effect |
| --- | --- | --- |
| `@nesor-skip` | (none) | Do not emit a file for this model. |
| `@nesor-entity-name <Name>` | identifier | Override the entity base (interface and meta const are named from this). |
| `@nesor-variant <Name> [include=...] [exclude=...] [withRelations=...]` | name + kv | Declare a variant. See [VARIANTS.md](./VARIANTS.md). |
| `@nesor-module <path>` | path | Route this model's file into a subfolder of the output root when `splitMode = "perModule"`. |

## Validation rules

- A tag in the wrong scope is an error (e.g. `@nesor-skip` on a field).
- Argument values are validated as TS identifiers (or paths for `@nesor-module`).
- Conflicting tags raise errors: `exclude + rename`, `secret + rename`, `secret + include-in`, `variant include= + exclude=`, duplicate variant names.
- Variant references must point at fields / relations that exist on the model.
