import type { Dirent } from 'node:fs'
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import type { GeneratorOptions } from '@prisma/generator-helper'
import type { NesorConfig } from './config.js'
import { parseConfig } from './config.js'
import { type WalkedSchema, walkDocument } from './dmmf/walker.js'
import { emitModelFile } from './emit/file.js'
import { emitSingleFile } from './emit/single.js'
import type { EmittedFile } from './emit/types.js'
import { NesorError, formatErrorRich } from './util/diagnostics.js'

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

/** Remove `.ts` files under `dir` that are not in `keep`. Returns nothing. */
async function pruneOrphans(dir: string, keep: ReadonlySet<string>): Promise<void> {
  const walk = async (curr: string): Promise<void> => {
    let entries: Dirent[]
    try {
      entries = (await readdir(curr, { withFileTypes: true })) as Dirent[]
    } catch {
      return
    }
    for (const e of entries) {
      const full = join(curr, e.name)
      if (e.isDirectory()) await walk(full)
      else if (e.isFile() && e.name.endsWith('.ts') && !keep.has(full)) {
        await rm(full, { force: true })
      }
    }
  }
  await walk(dir)
}

async function writeIfChanged(dest: string, text: string): Promise<void> {
  await mkdir(dirname(dest), { recursive: true })
  if (await pathExists(dest)) {
    try {
      const existing = await readFile(dest, 'utf8')
      if (existing === text) return
    } catch {
      /* fall through and overwrite */
    }
  }
  await writeFile(dest, text, 'utf8')
}

function emitAll(schema: WalkedSchema, config: NesorConfig): EmittedFile[] {
  if (config.splitMode === 'single') {
    const file = emitSingleFile(schema, config)
    return file ? [file] : []
  }
  const out: EmittedFile[] = []
  for (const model of schema.models) {
    const emitted = emitModelFile(model, schema, config)
    if (emitted) out.push(emitted)
  }
  return out
}

async function readSchemaText(schemaPath: string | undefined): Promise<string | undefined> {
  if (!schemaPath) return undefined
  try {
    return await readFile(schemaPath, 'utf8')
  } catch {
    return undefined
  }
}

/** Orchestrator invoked by the @prisma/generator-helper handler. */
export async function runGenerator(options: GeneratorOptions): Promise<void> {
  const schemaPath = options.schemaPath
  try {
    const config = parseConfig(
      options.generator.config as Record<string, string | string[] | undefined>,
    )

    const outputValue = options.generator.output?.value ?? config.output
    // `nesor check` redirects the output to a tmp dir via this env var so the
    // user's committed output is never mutated during a check. Must be absolute:
    // the generator runs in an unpredictable cwd under `prisma generate`, so a
    // relative path here would resolve against the wrong directory.
    const override = process.env.NESOR_OUTPUT_OVERRIDE
    if (override && !isAbsolute(override)) {
      throw new NesorError(
        `NESOR_OUTPUT_OVERRIDE must be an absolute path; got "${override}".`,
        'This env var is set by `nesor check` and is not part of the public API.',
      )
    }
    const outputDir = override ? override : resolve(outputValue)

    const schema = walkDocument(options.dmmf)

    await mkdir(outputDir, { recursive: true })

    const files = emitAll(schema, config)
    const expected = new Set<string>(files.map((f) => join(outputDir, f.path)))

    await pruneOrphans(outputDir, expected)

    for (const file of files) {
      await writeIfChanged(join(outputDir, file.path), file.text)
    }
  } catch (err) {
    if (err instanceof NesorError) {
      const schemaText = await readSchemaText(schemaPath)
      const rendered = formatErrorRich(err, schemaPath, schemaText)
      process.stderr.write(`${rendered}\n`)
      // Prisma swallows our stderr output and reprints only `err.message` under
      // `prisma generate`. Embed the rich diagnostic into the message itself so
      // the user still sees the source-spanned block.
      if (process.env.PRISMA_GENERATOR_INVOCATION) {
        const wrapped = new NesorError(rendered, err.hint, err.context, { cause: err })
        if (err.stack) wrapped.stack = err.stack
        throw wrapped
      }
      throw err
    }
    throw err
  }
}
