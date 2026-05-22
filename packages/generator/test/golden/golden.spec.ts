import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { NesorConfig } from '../../src/config.js'
import type { WalkedSchema } from '../../src/dmmf/walker.js'
import { emitModelFile } from '../../src/emit/file.js'
import { emitSingleFile } from '../../src/emit/single.js'
import * as cyclicRelations from './cyclic-relations/fixture.js'
import * as decimalBigint from './decimal-bigint/fixture.js'
import * as enumStrategies from './enum-strategies/fixture.js'
import * as minimal from './minimal/fixture.js'
import * as moduleRouting from './module-routing/fixture.js'
import * as nullable from './nullable/fixture.js'
import * as relationsM2M from './relations-many-to-many/fixture.js'
import * as relations1toM from './relations-1-to-many/fixture.js'
import * as secrets from './secrets/fixture.js'
import * as softDelete from './soft-delete/fixture.js'
import * as variants from './variants/fixture.js'

interface Fixture {
  name: string
  walkedSchema: WalkedSchema
  config: NesorConfig
}

const FIXTURES: Fixture[] = [
  { name: 'cyclic-relations', ...cyclicRelations },
  { name: 'decimal-bigint', ...decimalBigint },
  { name: 'enum-strategies', ...enumStrategies },
  { name: 'minimal', ...minimal },
  { name: 'module-routing', ...moduleRouting },
  { name: 'nullable', ...nullable },
  { name: 'relations-1-to-many', ...relations1toM },
  { name: 'relations-many-to-many', ...relationsM2M },
  { name: 'secrets', ...secrets },
  { name: 'soft-delete', ...softDelete },
  { name: 'variants', ...variants },
]

const HERE = dirname(fileURLToPath(import.meta.url))

function emitAll(fx: Fixture): Map<string, string> {
  const files = new Map<string, string>()
  if (fx.config.splitMode === 'single') {
    const f = emitSingleFile(fx.walkedSchema, fx.config)
    if (f) files.set(f.path, f.text)
    return files
  }
  for (const m of fx.walkedSchema.models) {
    const f = emitModelFile(m, fx.walkedSchema, fx.config)
    if (f) files.set(f.path, f.text)
  }
  return files
}

async function walkDir(dir: string): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  async function walk(curr: string): Promise<void> {
    let entries: Awaited<ReturnType<typeof readdir>>
    try {
      entries = await readdir(curr, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const full = join(curr, e.name)
      if (e.isDirectory()) await walk(full)
      else if (e.isFile() && e.name.endsWith('.ts')) {
        const text = await readFile(full, 'utf8')
        const rel = relative(dir, full).split('\\').join('/')
        out.set(rel, text)
      }
    }
  }
  await walk(dir)
  return out
}

async function writeGolden(dir: string, files: ReadonlyMap<string, string>): Promise<void> {
  await rm(dir, { recursive: true, force: true })
  for (const [path, text] of files) {
    const dest = resolve(dir, path)
    await mkdir(dirname(dest), { recursive: true })
    await writeFile(dest, text, 'utf8')
  }
}

const UPDATE = process.env.UPDATE_SNAPSHOTS === '1'

describe('golden fixtures', () => {
  for (const fx of FIXTURES) {
    it(fx.name, async () => {
      const expectedDir = resolve(HERE, fx.name, 'expected')
      const emitted = emitAll(fx)

      if (UPDATE) {
        await writeGolden(expectedDir, emitted)
        return
      }

      const expected = await walkDir(expectedDir)
      expect(emitted.size).toBeGreaterThan(0)
      expect([...emitted.keys()].sort()).toEqual([...expected.keys()].sort())
      for (const [path, text] of emitted) {
        expect(text, `file ${path}`).toBe(expected.get(path))
      }
    })
  }
})
