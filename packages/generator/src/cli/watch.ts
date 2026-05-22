import { watch } from 'node:fs'
import { stat } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import type { ParsedFlags } from './index.js'
import { spawnPrismaGenerate } from './run-prisma.js'

const DEBOUNCE_MS = 200

export async function runWatch(flags: ParsedFlags): Promise<number> {
  const schemaAbs = resolve(flags.cwd, flags.schema)
  try {
    await stat(schemaAbs)
  } catch {
    process.stderr.write(`[nesor] schema not found: ${schemaAbs}\n`)
    return 1
  }

  process.stdout.write(`[nesor] watching ${schemaAbs}\n`)

  // Initial generate. Surface non-zero exit so the user is not left wondering why
  // their watcher is running on a schema that never compiled.
  const initialCode = await spawnPrismaGenerate(flags.cwd, schemaAbs)
  if (initialCode !== 0) {
    process.stderr.write(`[nesor] initial generate exited with ${initialCode}\n`)
  }

  let timer: NodeJS.Timeout | undefined
  let running = false
  let pendingRerun = false

  const schedule = (): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(async () => {
      if (running) {
        pendingRerun = true
        return
      }
      running = true
      process.stdout.write('[nesor] schema changed — regenerating...\n')
      try {
        const code = await spawnPrismaGenerate(flags.cwd, schemaAbs)
        if (code !== 0) process.stderr.write(`[nesor] generate exited with ${code}\n`)
      } finally {
        running = false
        if (pendingRerun) {
          pendingRerun = false
          schedule()
        }
      }
    }, DEBOUNCE_MS)
  }

  // Watch the parent directory and filter by basename. fs.watch on a single file
  // breaks on Windows editors that save via atomic rename (VSCode, JetBrains, vim),
  // because the inode the watcher holds is replaced; watching the dir survives that.
  const schemaDir = dirname(schemaAbs)
  const schemaBase = basename(schemaAbs)
  const watcher = watch(schemaDir, { persistent: true })
  const onEvent = (_event: string, filename: string | null): void => {
    if (filename === null || filename === schemaBase) schedule()
  }
  watcher.on('change', onEvent)
  watcher.on('rename', onEvent)
  watcher.on('error', (err) => {
    process.stderr.write(`[nesor] watch error: ${err.message}\n`)
  })

  return new Promise<number>((resolveP) => {
    const shutdown = (code: number): void => {
      watcher.close()
      if (timer) clearTimeout(timer)
      resolveP(code)
    }
    process.on('SIGINT', () => shutdown(0))
    process.on('SIGTERM', () => shutdown(0))
  })
}
