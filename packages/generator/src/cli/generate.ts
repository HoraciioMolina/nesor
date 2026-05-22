import { stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { ParsedFlags } from './index.js'
import { spawnPrismaGenerate } from './run-prisma.js'

export async function runGenerate(flags: ParsedFlags): Promise<number> {
  const schemaAbs = resolve(flags.cwd, flags.schema)
  try {
    await stat(schemaAbs)
  } catch {
    process.stderr.write(`[nesor] schema not found: ${schemaAbs}\n`)
    return 1
  }
  return await spawnPrismaGenerate(flags.cwd, schemaAbs)
}
