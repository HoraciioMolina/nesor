import { styleText } from 'node:util'
import { type LocatedLine, type SourceLookup, locateInSchema } from './source-location.js'

export type SourceContext = SourceLookup

/** Structured error thrown by Nesor with a user-facing message. */
export class NesorError extends Error {
  constructor(
    message: string,
    readonly hint?: string,
    readonly context?: SourceContext,
    options?: { cause?: unknown },
  ) {
    super(message, options)
    this.name = 'NesorError'
  }
}

type StyleFormat = 'red' | 'cyan' | 'gray' | 'yellow' | 'bold'

function colorize(format: StyleFormat, text: string, useColor: boolean): string {
  if (!useColor) return text
  if (typeof styleText !== 'function') return text
  try {
    return (styleText as (f: StyleFormat, t: string) => string)(format, text)
  } catch {
    return text
  }
}

function colorEnabled(): boolean {
  if (process.env.NO_COLOR) return false
  if (process.env.FORCE_COLOR) return true
  return Boolean(process.stderr.isTTY)
}

/** Plain text formatter — used when no schema source is available. */
export function formatError(err: unknown): string {
  if (err instanceof NesorError) {
    return err.hint ? `[nesor] ${err.message}\nHint: ${err.hint}` : `[nesor] ${err.message}`
  }
  if (err instanceof Error) return `[nesor] ${err.message}`
  return `[nesor] ${String(err)}`
}

function renderSourceBlock(schemaPath: string, loc: LocatedLine, useColor: boolean): string[] {
  const lines: string[] = []
  const lineNumStr = String(loc.line).padStart(5, ' ')
  const pathLabel = colorize('gray', `${schemaPath}:${loc.line}:${loc.col}`, useColor)
  const pipe = colorize('gray', '│', useColor)
  const headRule = colorize('gray', '╭────', useColor)
  const tailRule = colorize('gray', '╰─────', useColor)

  lines.push(`        ${headRule} ${pathLabel}`)
  lines.push(`${colorize('gray', lineNumStr, useColor)} ${pipe} ${loc.text}`)
  if (loc.underline) {
    const prefix = ' '.repeat(loc.underline.start)
    const mark = colorize('red', '─'.repeat(loc.underline.length), useColor)
    lines.push(`        ${pipe} ${prefix}${mark}`)
  }
  lines.push(`        ${tailRule}`)
  return lines
}

/** Rich formatter — adds a source-spanned diagnostic block when the schema text is available. */
export function formatErrorRich(err: unknown, schemaPath?: string, schemaText?: string): string {
  if (!(err instanceof NesorError)) return formatError(err)
  const useColor = colorEnabled()
  const out: string[] = []
  out.push(colorize('red', `[nesor] ${err.message}`, useColor))

  if (err.context && schemaPath && schemaText) {
    const loc = locateInSchema(schemaText, err.context)
    if (loc) out.push(...renderSourceBlock(schemaPath, loc, useColor))
  }
  if (err.hint) out.push(`${colorize('cyan', 'Hint:', useColor)} ${err.hint}`)
  return out.join('\n')
}
