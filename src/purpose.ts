import type { WellKnownPurpose } from './types.js'

export const WELL_KNOWN_PURPOSES: readonly WellKnownPurpose[] = ['assessing', 'bookmarking', 'classifying', 'commenting', 'describing', 'editing', 'highlighting', 'identifying', 'linking', 'moderating', 'questioning', 'replying', 'tagging']

const OA = 'http://www.w3.org/ns/oa#'
const known: ReadonlySet<string> = new Set(WELL_KNOWN_PURPOSES)

// Canonicalizes a well-known purpose (in any accepted form) to its short token; any other purpose is returned unchanged, so a caller-supplied custom IRI is preserved.
export function purposeToken(purpose: string | undefined): string | undefined {
  if (!purpose) return purpose
  const local = purpose.startsWith(OA) ? purpose.slice(OA.length)
    : purpose.startsWith('oa:') ? purpose.slice(3)
    : purpose
  return known.has(local) ? local : purpose
}
