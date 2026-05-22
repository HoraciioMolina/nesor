import { createHash } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { NesorError } from '../util/diagnostics.js'
import type { ParsedFlags } from './index.js'
import { spawnPrismaGenerate } from './run-prisma.js'

function findOutputDir(schemaText: string): string {
  const generatorBlocks = schemaText.matchAll(/generator\s+\w+\s*\{([^}]+)\}/g)
  for (const m of generatorBlocks) {
    const body = m[1] ?? ''
    if (!/provider\s*=\s*"nesor"/.test(body)) continue
    const outMatch = body.match(/output\s*=\s*"([^"]+)"/)
    if (outMatch?.[1]) return outMatch[1]
  }
  throw new NesorError(
    'Could not find a nesor generator block in the schema.',
    'Add `generator nesor { provider = "nesor" output = "..." }` to your schema.prisma.',
  )
}

async function hashDirectory(dir: string): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  try {
    await stat(dir)
  } catch {
    return out
  }

  async function walk(curr: string): Promise<void> {
    const entries = await readdir(curr, { withFileTypes: true })
    for (const e of entries) {
      const full = join(curr, e.name)
      if (e.isDirectory()) {
        await walk(full)
      } else if (e.isFile()) {
        const buf = await readFile(full)
        const h = createHash('sha256').update(buf).digest('hex')
        const rel = relative(dir, full).split('\\').join('/')
        out.set(rel, h)
      }
    }
  }
  await walk(dir)
  return out
}

export async function runCheck(flags: ParsedFlags): Promise<number> {
  const schemaAbs = resolve(flags.cwd, flags.schema)
  const schemaText = await readFile(schemaAbs, 'utf8')
  const outputRel = findOutputDir(schemaText)
  // schema-relative path → absolute
  const outputAbs = resolve(schemaAbs, '..', outputRel)

  // Generate to a throwaway dir; the user's committed output is never mutated.
  const sandbox = await mkdtemp(join(tmpdir(), 'nesor-check-'))
  try {
    const code = await spawnPrismaGenerate(flags.cwd, schemaAbs, {
      NESOR_OUTPUT_OVERRIDE: sandbox,
    })
    if (code !== 0) {
      process.stderr.write(`[nesor] check: prisma generate exited with ${code}\n`)
      return code
    }

    const onDisk = await hashDirectory(outputAbs)
    const fresh = await hashDirectory(sandbox)

    const changed: string[] = []
    const added: string[] = []
    const removed: string[] = []
    for (const [path, h] of fresh) {
      const prev = onDisk.get(path)
      if (prev === undefined) added.push(path)
      else if (prev !== h) changed.push(path)
    }
    for (const path of onDisk.keys()) {
      if (!fresh.has(path)) removed.push(path)
    }

    if (changed.length === 0 && added.length === 0 && removed.length === 0) {
      process.stdout.write('[nesor] check: no drift.\n')
      return 0
    }

    process.stderr.write('[nesor] check: generated files drifted from disk.\n')
    for (const p of changed) process.stderr.write(`  changed: ${p}\n`)
    for (const p of added) process.stderr.write(`  added:   ${p}\n`)
    for (const p of removed) process.stderr.write(`  removed: ${p}\n`)
    process.stderr.write(
      'Commit the regenerated files or rerun `pnpm prisma generate` locally to update them.\n',
    )
    return 1
  } finally {
    await rm(sandbox, { recursive: true, force: true })
  }
}
