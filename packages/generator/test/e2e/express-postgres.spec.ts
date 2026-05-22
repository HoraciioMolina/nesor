import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const EXAMPLE = resolve(HERE, '..', '..', '..', '..', 'examples', 'express-postgres')

interface RunResult {
  code: number
  stdout: string
  stderr: string
}

function run(
  cmd: string,
  args: readonly string[],
  cwd: string,
  timeoutMs = 60_000,
): Promise<RunResult> {
  return new Promise<RunResult>((resolveP) => {
    const child = spawn(cmd, args, {
      cwd,
      shell: process.platform === 'win32',
      env: process.env,
    })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (b: Buffer) => {
      stdout += b.toString()
    })
    child.stderr?.on('data', (b: Buffer) => {
      stderr += b.toString()
    })
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      resolveP({ code: 124, stdout, stderr: `${stderr}\n[timed out after ${timeoutMs}ms]` })
    }, timeoutMs)
    child.on('exit', (code) => {
      clearTimeout(timer)
      resolveP({ code: code ?? 0, stdout, stderr })
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      resolveP({ code: 1, stdout, stderr: `${stderr}\n${err.message}` })
    })
  })
}

const RUN_E2E = process.env.SKIP_E2E !== '1' && existsSync(EXAMPLE)

describe.skipIf(!RUN_E2E)('e2e: examples/express-postgres', () => {
  it('runs `prisma generate` and produces the expected entity files', async () => {
    const result = await run('npx', ['prisma', 'generate'], EXAMPLE)
    expect(result.code, `stderr:\n${result.stderr}\nstdout:\n${result.stdout}`).toBe(0)
    expect(existsSync(join(EXAMPLE, 'src/generated/entities/model-a.entity.ts'))).toBe(true)
    expect(existsSync(join(EXAMPLE, 'src/generated/entities/model-b.entity.ts'))).toBe(true)
  }, 90_000)

  it('compiles the example with tsc --noEmit', async () => {
    const result = await run('npx', ['tsc', '-p', 'tsconfig.json', '--noEmit'], EXAMPLE)
    expect(result.code, `stderr:\n${result.stderr}\nstdout:\n${result.stdout}`).toBe(0)
  }, 90_000)
})
