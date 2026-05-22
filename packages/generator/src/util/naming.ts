export type FileNameStyle = 'kebab' | 'camel' | 'pascal'

/** Split a PascalCase / camelCase / snake_case / kebab-case identifier into words. */
function splitWords(input: string): string[] {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0)
}

function capitalize(word: string): string {
  if (word.length === 0) return word
  return word.charAt(0).toUpperCase() + word.slice(1)
}

/** Convert an identifier to the requested file-name style. */
export function toFileBaseName(modelName: string, style: FileNameStyle): string {
  const words = splitWords(modelName).map((w) => w.toLowerCase())
  if (words.length === 0) return modelName
  switch (style) {
    case 'kebab':
      return words.join('-')
    case 'camel': {
      const [head, ...rest] = words
      return (head ?? '') + rest.map(capitalize).join('')
    }
    case 'pascal':
      return words.map(capitalize).join('')
  }
}
