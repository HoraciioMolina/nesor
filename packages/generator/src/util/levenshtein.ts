/** Compute Levenshtein edit distance between two strings. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const prev = new Array<number>(b.length + 1)
  const curr = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j++) prev[j] = j

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1
      const del = (prev[j] ?? 0) + 1
      const ins = (curr[j - 1] ?? 0) + 1
      const sub = (prev[j - 1] ?? 0) + cost
      curr[j] = Math.min(del, ins, sub)
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j] ?? 0
  }
  return prev[b.length] ?? 0
}

/** Return the closest candidate within `maxDistance` edits, or undefined. */
export function suggestKey(
  input: string,
  candidates: readonly string[],
  maxDistance = 3,
): string | undefined {
  let best: string | undefined
  let bestDist = maxDistance + 1
  for (const c of candidates) {
    const d = levenshtein(input, c)
    if (d < bestDist) {
      best = c
      bestDist = d
    }
  }
  return bestDist <= maxDistance ? best : undefined
}
