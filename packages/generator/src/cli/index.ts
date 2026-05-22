import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NesorError, formatError } from '../util/diagnostics.js'
import { runCheck } from './check.js'
import { runGenerate } from './generate.js'
import { runInit } from './init.js'
import { spawnPrisma } from './run-prisma.js'
import { runWatch } from './watch.js'

const HELP = `Nesor — Prisma generator for clean, modular TypeScript domain entities.

Usage:
  nesor                    Run as a Prisma generator (invoked by \`prisma generate\`)
  nesor generate           Run \`prisma generate\` (this is what you'll use day-to-day)
  nesor watch              Watch schema.prisma and run \`prisma generate\` on change
  nesor check              Run the generator and fail if any output drifts from disk
  nesor init               Append a generator nesor block to schema.prisma
  nesor <prisma-subcmd>    Anything else is forwarded to \`prisma\` (e.g.
                           \`nesor migrate dev\`, \`nesor studio\`, \`nesor format\`)
  nesor --version          Print the installed version
  nesor --help             Print this message

The watch / check / init subcommands also accept their --flag form (--watch,
--check, --init) for convenience.

Common flags (for nesor's own subcommands):
  --schema <path>          Path to schema.prisma (default: prisma/schema.prisma)
  --cwd <path>             Working directory (default: process.cwd())

Both \`--schema <path>\` and \`--schema=<path>\` are accepted (same for --cwd).
Forwarded prisma subcommands pass their arguments through verbatim.
`

async function readOwnVersion(): Promise<string> {
  try {
    const here = dirname(fileURLToPath(import.meta.url))
    const pkgPath = join(here, '..', '..', 'package.json')
    const txt = await readFile(pkgPath, 'utf8')
    const parsed = JSON.parse(txt) as { version?: string }
    return parsed.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

export interface ParsedFlags {
  schema: string
  cwd: string
  positional: string[]
}

export function parseFlags(argv: readonly string[]): ParsedFlags {
  const out: ParsedFlags = {
    schema: 'prisma/schema.prisma',
    cwd: process.cwd(),
    positional: [],
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === undefined) continue
    if (a.startsWith('--schema=')) {
      const v = a.slice('--schema='.length)
      if (!v) throw new NesorError('--schema requires a path argument.')
      out.schema = v
    } else if (a === '--schema') {
      const next = argv[i + 1]
      if (!next) throw new NesorError('--schema requires a path argument.')
      out.schema = next
      i++
    } else if (a.startsWith('--cwd=')) {
      const v = a.slice('--cwd='.length)
      if (!v) throw new NesorError('--cwd requires a path argument.')
      out.cwd = v
    } else if (a === '--cwd') {
      const next = argv[i + 1]
      if (!next) throw new NesorError('--cwd requires a path argument.')
      out.cwd = next
      i++
    } else {
      out.positional.push(a)
    }
  }
  return out
}

const SUBCOMMAND_ALIASES: Readonly<Record<string, string>> = {
  '--watch': 'watch',
  '--check': 'check',
  '--init': 'init',
  '--generate': 'generate',
}

/** Extract --cwd (and only --cwd) from passthrough args, leaving the rest for prisma. */
function extractCwd(args: readonly string[]): { cwd: string; rest: string[] } {
  let cwd = process.cwd()
  const rest: string[] = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === undefined) continue
    if (a.startsWith('--cwd=')) {
      const v = a.slice('--cwd='.length)
      if (!v) throw new NesorError('--cwd requires a path argument.')
      cwd = v
    } else if (a === '--cwd') {
      const next = args[i + 1]
      if (!next) throw new NesorError('--cwd requires a path argument.')
      cwd = next
      i++
    } else {
      rest.push(a)
    }
  }
  return { cwd, rest }
}

/** CLI entry. Returns exit code. */
export async function runCli(argv: readonly string[]): Promise<number> {
  const raw = argv[0]
  // Object.hasOwn (not `in`) so a positional like `__proto__` cannot match
  // Object.prototype and silently become an empty subcommand.
  const cmd =
    raw !== undefined && Object.hasOwn(SUBCOMMAND_ALIASES, raw) ? SUBCOMMAND_ALIASES[raw] : raw
  try {
    if (cmd === '--version' || cmd === '-v') {
      process.stdout.write(`${await readOwnVersion()}\n`)
      return 0
    }
    if (cmd === undefined || cmd === '--help' || cmd === '-h') {
      process.stdout.write(HELP)
      return 0
    }
    if (cmd === 'watch') return await runWatch(parseFlags(argv.slice(1)))
    if (cmd === 'check') return await runCheck(parseFlags(argv.slice(1)))
    if (cmd === 'init') return await runInit(parseFlags(argv.slice(1)))
    if (cmd === 'generate') return await runGenerate(parseFlags(argv.slice(1)))
    // Anything else: forward to `prisma` so `nesor migrate dev`, `nesor studio`,
    // `nesor format`, etc. all work without us having to enumerate prisma's CLI.
    // We refuse to forward unknown --flags (they're almost always typos of our
    // own flags) to avoid silently treating `nesor --frobnicate` as prisma input.
    if (cmd?.startsWith('--')) {
      process.stderr.write(`[nesor] Unknown flag: ${cmd}\nRun \`nesor --help\` for usage.\n`)
      return 2
    }
    const { cwd, rest } = extractCwd(argv.slice(1))
    return await spawnPrisma(cwd, [cmd as string, ...rest])
  } catch (err) {
    process.stderr.write(`${formatError(err)}\n`)
    return 1
  }
}
