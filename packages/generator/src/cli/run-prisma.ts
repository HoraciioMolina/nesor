import { spawn } from 'node:child_process'

/** Spawn `npx prisma <...args>` inheriting stdio. Resolves with the exit code. */
export function spawnPrisma(
  cwd: string,
  args: readonly string[],
  envOverrides?: Readonly<Record<string, string>>,
): Promise<number> {
  return new Promise((resolveP) => {
    const child = spawn('npx', ['prisma', ...args], {
      cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: envOverrides ? { ...process.env, ...envOverrides } : process.env,
    })
    child.on('exit', (code) => resolveP(code ?? 0))
    child.on('error', () => resolveP(1))
  })
}

/** Spawn `npx prisma generate --schema <schemaPath>` inheriting stdio. Resolves with the exit code. */
export function spawnPrismaGenerate(
  cwd: string,
  schemaPath: string,
  envOverrides?: Readonly<Record<string, string>>,
): Promise<number> {
  return spawnPrisma(cwd, ['generate', '--schema', schemaPath], envOverrides)
}
