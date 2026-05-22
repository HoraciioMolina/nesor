#!/usr/bin/env node
// prepublishOnly guard.
//
// In a pnpm workspace, internal deps may use the "workspace:" protocol. pnpm
// rewrites those specifiers to concrete versions when packing; npm does NOT —
// it would ship literal "workspace:*" strings and break consumers.
//
// This script refuses to publish from non-pnpm tooling so we never ship a
// broken tarball. Run via `pnpm publish` (preferred) or `pnpm release` from
// the monorepo root.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const pkgPath = resolve(here, '..', 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))

const ua = process.env.npm_config_user_agent ?? ''
const isPnpm = ua.startsWith('pnpm/')

function hasWorkspaceRef(deps) {
  if (!deps) return false
  return Object.values(deps).some((v) => typeof v === 'string' && v.startsWith('workspace:'))
}

const usesWorkspaceProtocol =
  hasWorkspaceRef(pkg.dependencies) ||
  hasWorkspaceRef(pkg.devDependencies) ||
  hasWorkspaceRef(pkg.peerDependencies) ||
  hasWorkspaceRef(pkg.optionalDependencies)

if (usesWorkspaceProtocol && !isPnpm) {
  process.stderr.write(
    [
      '',
      `[${pkg.name}] Refusing to publish: package.json uses the "workspace:" protocol`,
      'but the publish was not invoked via pnpm.',
      '',
      'npm does not rewrite "workspace:" specifiers when packing, so the published',
      'tarball would ship literal "workspace:^" strings and break installs.',
      '',
      'Use `pnpm publish` (or `pnpm release` from the monorepo root) instead.',
      '',
    ].join('\n'),
  )
  process.exit(1)
}

process.stdout.write(`[${pkg.name}] prepublishOnly check passed (publisher=${ua || 'unknown'}).\n`)
