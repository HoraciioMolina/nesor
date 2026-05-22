#!/usr/bin/env node
import { runCli } from './cli/index.js'

const argv = process.argv.slice(2)
if (argv.length === 0) {
  // No args: act as a Prisma generator handler (registered on import).
  await import('./index.js')
} else {
  const code = await runCli(argv)
  if (code !== 0) process.exit(code)
}
