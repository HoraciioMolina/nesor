# Changelog

All notable changes are tracked via [Changesets](https://github.com/changesets/changesets). See `.changeset/` for pending entries and individual package `CHANGELOG.md` files after release.

## 0.1.1 — 2026-05-22

Docs-only patch. No code changes.

- Repository URL fix: `horaciomolina/nesor` → `HoraciioMolina/nesor` across all `package.json` fields and README links. Every doc link from the published npm page now resolves to a real GitHub URL.
- README polish: SVG banner ([`assets/banner.svg`](./assets/banner.svg)), shields.io badges, and dropped the `ts` language hint on the emitted-code block so it stays legible in npm's dark theme.

## 0.1.0 — 2026-05-22

First real release.

- Initial public release of `nesor` and `@nesor/mapper`.
- `nesor generate` subcommand plus transparent passthrough for any other `prisma` subcommand (`nesor migrate dev`, `nesor studio`, …).
- Bundled `prisma` and `@prisma/generator-helper` as direct deps so `pnpm add -D nesor` is sufficient.
- Per-package `LICENSE` and `prepublishOnly` guard that aborts any non-pnpm publisher (mapper peers on `nesor` via `workspace:^`).

## 0.0.1

Reserved-name placeholder releases on npm (no functionality).
