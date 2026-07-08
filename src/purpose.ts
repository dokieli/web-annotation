/*!
Copyright 2012-2026 Sarven Capadisli <https://csarven.ca/>
Copyright 2023-2026 Virginia Balseiro <https://virginiabalseiro.com/>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

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
