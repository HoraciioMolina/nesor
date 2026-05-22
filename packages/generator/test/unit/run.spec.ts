import { mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { GeneratorOptions } from '@prisma/generator-helper'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runGenerator } from '../../src/run.js'

interface Sandbox {
  dir: string
  schemaPath: string
  outputDir: string
}

let sandbox: Sandbox

async function makeSandbox(): Promise<Sandbox> {
  const dir = await mkdtemp(join(tmpdir(), 'nesor-run-'))
  const schemaPath = join(dir, 'schema.prisma')
  const outputDir = join(dir, 'generated')
  await writeFile(schemaPath, '// scratch schema for run.spec.ts', 'utf8')
  return { dir, schemaPath, outputDir }
}

interface ModelSpec {
  documentation?: string
  fields: { name: string; type: string }[]
}

function makeOptions(modelsByName: Record<string, ModelSpec>, sb: Sandbox): GeneratorOptions {
  const models = Object.entries(modelsByName).map(([name, m]) => ({
    name,
    dbName: null,
    documentation: m.documentation,
    fields: m.fields.map((f) => ({
      name: f.name,
      kind: 'scalar',
      isList: false,
      isRequired: true,
      isUnique: false,
      isId: f.name === 'id',
      isReadOnly: false,
      hasDefaultValue: false,
      type: f.type,
      isGenerated: false,
      isUpdatedAt: false,
    })),
    primaryKey: null,
    uniqueFields: [],
    uniqueIndexes: [],
  }))
  return {
    schemaPath: sb.schemaPath,
    generator: {
      name: 'nesor',
      provider: { value: 'nesor', fromEnvVar: null },
      output: { value: sb.outputDir, fromEnvVar: null },
      config: {},
      binaryTargets: [],
      previewFeatures: [],
      sourceFilePath: sb.schemaPath,
    },
    dmmf: {
      datamodel: { models, enums: [] },
    },
  } as unknown as GeneratorOptions
}

async function listTsFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.ts'))
    .map((e) => e.name)
    .sort()
}

beforeEach(async () => {
  sandbox = await makeSandbox()
})

afterEach(async () => {
  await rm(sandbox.dir, { recursive: true, force: true })
})

describe('runGenerator idempotency + orphan pruning', () => {
  it('does not change mtimes when content is identical across two runs', async () => {
    const opts = makeOptions({ ModelA: { fields: [{ name: 'id', type: 'String' }] } }, sandbox)
    await runGenerator(opts)
    const before = await stat(join(sandbox.outputDir, 'model-a.entity.ts'))
    await new Promise((r) => setTimeout(r, 50))
    await runGenerator(opts)
    const after = await stat(join(sandbox.outputDir, 'model-a.entity.ts'))
    expect(after.mtimeMs).toBe(before.mtimeMs)
  })

  it('updates mtime only for the file whose content changed', async () => {
    const optsA = makeOptions(
      {
        ModelA: { fields: [{ name: 'id', type: 'String' }] },
        ModelB: { fields: [{ name: 'id', type: 'String' }] },
      },
      sandbox,
    )
    await runGenerator(optsA)
    const aBefore = await stat(join(sandbox.outputDir, 'model-a.entity.ts'))
    const bBefore = await stat(join(sandbox.outputDir, 'model-b.entity.ts'))

    await new Promise((r) => setTimeout(r, 50))

    const optsB = makeOptions(
      {
        ModelA: {
          fields: [
            { name: 'id', type: 'String' },
            { name: 'extra', type: 'Int' },
          ],
        },
        ModelB: { fields: [{ name: 'id', type: 'String' }] },
      },
      sandbox,
    )
    await runGenerator(optsB)

    const aAfter = await stat(join(sandbox.outputDir, 'model-a.entity.ts'))
    const bAfter = await stat(join(sandbox.outputDir, 'model-b.entity.ts'))
    expect(aAfter.mtimeMs).toBeGreaterThan(aBefore.mtimeMs)
    expect(bAfter.mtimeMs).toBe(bBefore.mtimeMs)
  })

  it('deletes orphan .ts files when their model is removed from the schema', async () => {
    const opts1 = makeOptions(
      {
        ModelA: { fields: [{ name: 'id', type: 'String' }] },
        ModelB: { fields: [{ name: 'id', type: 'String' }] },
      },
      sandbox,
    )
    await runGenerator(opts1)
    expect(await listTsFiles(sandbox.outputDir)).toEqual(['model-a.entity.ts', 'model-b.entity.ts'])

    const opts2 = makeOptions({ ModelA: { fields: [{ name: 'id', type: 'String' }] } }, sandbox)
    await runGenerator(opts2)
    expect(await listTsFiles(sandbox.outputDir)).toEqual(['model-a.entity.ts'])
  })

  it('honors NESOR_OUTPUT_OVERRIDE and does not touch the configured output', async () => {
    const opts = makeOptions({ ModelA: { fields: [{ name: 'id', type: 'String' }] } }, sandbox)
    const override = join(sandbox.dir, 'sandbox-out')
    const prev = process.env.NESOR_OUTPUT_OVERRIDE
    process.env.NESOR_OUTPUT_OVERRIDE = override
    try {
      await runGenerator(opts)
    } finally {
      if (prev === undefined) Reflect.deleteProperty(process.env, 'NESOR_OUTPUT_OVERRIDE')
      else process.env.NESOR_OUTPUT_OVERRIDE = prev
    }
    expect(await listTsFiles(override)).toEqual(['model-a.entity.ts'])
    // The configured outputDir must not have been created.
    await expect(stat(sandbox.outputDir)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects a relative NESOR_OUTPUT_OVERRIDE with a clear error', async () => {
    const opts = makeOptions({ ModelA: { fields: [{ name: 'id', type: 'String' }] } }, sandbox)
    const prev = process.env.NESOR_OUTPUT_OVERRIDE
    process.env.NESOR_OUTPUT_OVERRIDE = './relative-bad'
    try {
      await expect(runGenerator(opts)).rejects.toMatchObject({
        name: 'NesorError',
        message: expect.stringContaining('must be an absolute path'),
      })
    } finally {
      if (prev === undefined) Reflect.deleteProperty(process.env, 'NESOR_OUTPUT_OVERRIDE')
      else process.env.NESOR_OUTPUT_OVERRIDE = prev
    }
  })
})

describe('runGenerator diagnostic embedding under prisma generate', () => {
  it('wraps the rich diagnostic into err.message when PRISMA_GENERATOR_INVOCATION is set', async () => {
    await writeFile(
      sandbox.schemaPath,
      [
        'generator nesor { provider = "nesor" output = "./generated" }',
        '',
        '/// @nesor-variant Bad include=nope',
        'model ModelA {',
        '  id String @id',
        '}',
      ].join('\n'),
      'utf8',
    )
    const opts = makeOptions(
      {
        ModelA: {
          documentation: '@nesor-variant Bad include=nope',
          fields: [{ name: 'id', type: 'String' }],
        },
      },
      sandbox,
    )

    const prev = process.env.PRISMA_GENERATOR_INVOCATION
    process.env.PRISMA_GENERATOR_INVOCATION = '1'
    try {
      let caught: unknown
      try {
        await runGenerator(opts)
      } catch (err) {
        caught = err
      }
      expect(caught).toBeDefined()
      const msg = (caught as Error).message
      expect(msg).toContain('[nesor]')
      expect(msg).toContain('references unknown field "nope"')
    } finally {
      if (prev === undefined) Reflect.deleteProperty(process.env, 'PRISMA_GENERATOR_INVOCATION')
      else process.env.PRISMA_GENERATOR_INVOCATION = prev
    }
  })

  it('does not wrap diagnostic into err.message outside prisma generate', async () => {
    const opts = makeOptions(
      {
        ModelA: {
          documentation: '@nesor-variant Bad include=nope',
          fields: [{ name: 'id', type: 'String' }],
        },
      },
      sandbox,
    )
    const prev = process.env.PRISMA_GENERATOR_INVOCATION
    Reflect.deleteProperty(process.env, 'PRISMA_GENERATOR_INVOCATION')
    try {
      let caught: unknown
      try {
        await runGenerator(opts)
      } catch (err) {
        caught = err
      }
      expect(caught).toBeDefined()
      const msg = (caught as Error).message
      expect(msg).not.toContain('[nesor]')
      expect(msg).toContain('references unknown field "nope"')
    } finally {
      if (prev !== undefined) process.env.PRISMA_GENERATOR_INVOCATION = prev
    }
  })
})
