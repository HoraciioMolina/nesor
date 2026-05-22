import { readFile, stat, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { ParsedFlags } from './index.js'
import { spawnPrisma } from './run-prisma.js'

const TEMPLATE = `
generator nesor {
  provider = "nesor"
  output   = "../src/generated/entities"
}
`

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

/**
 * Bootstrap a Prisma + Nesor project.
 *   - No schema yet → `prisma init` creates one, then we append the nesor block.
 *   - Schema exists  → just append the nesor block (idempotent: noop if already present).
 */
export async function runInit(flags: ParsedFlags): Promise<number> {
  const schemaAbs = resolve(flags.cwd, flags.schema)

  if (!(await fileExists(schemaAbs))) {
    process.stdout.write('[nesor] init: no schema found — running `prisma init`...\n')
    const code = await spawnPrisma(flags.cwd, ['init'])
    if (code !== 0) {
      process.stderr.write(`[nesor] init: prisma init exited with ${code}\n`)
      return code
    }
    // `prisma init` writes to ./prisma/schema.prisma. If the user passed a
    // custom --schema path, that's where they expect the block — but prisma
    // doesn't accept a target path, so we surface the mismatch instead of
    // silently writing the nesor block to the wrong file.
    if (!(await fileExists(schemaAbs))) {
      process.stderr.write(
        `[nesor] init: prisma init did not create ${schemaAbs}. If you passed a custom --schema path, run \`prisma init\` manually and re-run \`nesor init\`.\n`,
      )
      return 1
    }
  }

  const text = await readFile(schemaAbs, 'utf8')
  if (/generator\s+nesor\s*\{/.test(text)) {
    process.stdout.write(
      `[nesor] init: a "generator nesor" block already exists in ${schemaAbs}.\n`,
    )
    return 0
  }
  const newline = text.endsWith('\n') ? '' : '\n'
  const next = `${text}${newline}${TEMPLATE}`
  await writeFile(schemaAbs, next, 'utf8')
  process.stdout.write(`[nesor] init: added generator nesor block to ${schemaAbs}.\n`)
  process.stdout.write('Next: pnpm nesor generate\n')
  return 0
}
