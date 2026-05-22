import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseFlags, runCli } from '../../../src/cli/index.js'
import { NesorError } from '../../../src/util/diagnostics.js'

// Stub the prisma spawner. These tests only exercise CLI dispatching, not
// actual prisma invocation — and `npx prisma` cannot reliably resolve from
// a fresh tmpdir cwd on Windows CI.
vi.mock('../../../src/cli/run-prisma.js', async () => {
  const spawnPrisma = vi.fn().mockResolvedValue(0)
  const spawnPrismaGenerate = vi.fn().mockResolvedValue(0)
  return { spawnPrisma, spawnPrismaGenerate }
})
const { spawnPrisma } = await import('../../../src/cli/run-prisma.js')

describe('parseFlags', () => {
  it('uses defaults when no flags are passed', () => {
    const r = parseFlags([])
    expect(r.schema).toBe('prisma/schema.prisma')
    expect(r.positional).toEqual([])
    expect(r.cwd).toBe(process.cwd())
  })

  it('parses --schema', () => {
    const r = parseFlags(['--schema', './other.prisma'])
    expect(r.schema).toBe('./other.prisma')
  })

  it('parses --cwd', () => {
    const r = parseFlags(['--cwd', '/tmp/proj'])
    expect(r.cwd).toBe('/tmp/proj')
  })

  it('captures positional arguments', () => {
    const r = parseFlags(['stuff', '--schema', 'a.prisma', 'more'])
    expect(r.positional).toEqual(['stuff', 'more'])
    expect(r.schema).toBe('a.prisma')
  })

  it('errors when --schema is missing its value', () => {
    expect(() => parseFlags(['--schema'])).toThrow(NesorError)
  })

  it('parses --schema=<path> (equals form)', () => {
    const r = parseFlags(['--schema=./alt.prisma'])
    expect(r.schema).toBe('./alt.prisma')
    expect(r.positional).toEqual([])
  })

  it('parses --cwd=<path> (equals form)', () => {
    const r = parseFlags(['--cwd=/tmp/proj'])
    expect(r.cwd).toBe('/tmp/proj')
  })

  it('rejects an empty --schema= value', () => {
    expect(() => parseFlags(['--schema='])).toThrow(NesorError)
  })
})

describe('runCli subcommand aliases', () => {
  let stderr: string
  let stdout: string
  let stderrSpy: ReturnType<typeof vi.spyOn>
  let stdoutSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    stderr = ''
    stdout = ''
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderr += String(chunk)
      return true
    })
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdout += String(chunk)
      return true
    })
  })

  afterEach(() => {
    stderrSpy.mockRestore()
    stdoutSpy.mockRestore()
  })

  it('recognizes --check as the check subcommand (does not error as Unknown subcommand)', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'nesor-cli-'))
    const code = await runCli(['--check', '--cwd', tmp, '--schema', 'nope.prisma'])
    // We do NOT care about exit code semantics here (the schema does not exist);
    // we only care that the dispatcher did not treat --check as unknown.
    expect(code).not.toBe(2)
    expect(stderr).not.toContain('Unknown subcommand')
  })

  it('recognizes --init as the init subcommand', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'nesor-cli-'))
    const code = await runCli(['--init', '--cwd', tmp, '--schema', 'nope.prisma'])
    expect(code).not.toBe(2)
    expect(stderr).not.toContain('Unknown subcommand')
  })

  it('recognizes --generate as the generate subcommand', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'nesor-cli-'))
    const code = await runCli(['--generate', '--cwd', tmp, '--schema', 'nope.prisma'])
    // Schema does not exist, so we expect a non-zero exit, but NOT the
    // "Unknown flag" exit-2 path; the dispatcher should have routed to generate.
    expect(code).not.toBe(2)
    expect(stderr).not.toContain('Unknown flag')
  })

  it('rejects an unknown --flag with exit 2 instead of forwarding to prisma', async () => {
    const code = await runCli(['--frobnicate'])
    expect(code).toBe(2)
    expect(stderr).toContain('Unknown flag')
  })

  it('does not let prototype keys (e.g. __proto__) sneak past the alias map', async () => {
    // __proto__ is a bare positional, not a --flag, so it gets forwarded to
    // the bundled prisma. The crucial property is that the alias-map lookup
    // did NOT promote __proto__ to one of our own subcommands via Object
    // prototype inheritance — verify by checking that spawnPrisma saw the
    // raw "__proto__" arg.
    vi.mocked(spawnPrisma).mockClear()
    const code = await runCli(['__proto__'])
    expect(code).toBe(0)
    expect(spawnPrisma).toHaveBeenCalledWith(expect.any(String), ['__proto__'])
  })
})
