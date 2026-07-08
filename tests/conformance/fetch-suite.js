// Acquires the W3C w3c/web-annotation-tests suite for the conformance test. The suite is NOT
// vendored: it is fetched from GitHub at the pinned COMMIT and cached under web-annotation-tests/
// (gitignored, never committed). The cache is reused while it matches COMMIT; otherwise it is
// pulled fresh. Offline, any cached copy is reused; with neither network nor cache, ensureSuite()
// returns false so the caller can skip. Bump COMMIT to move to a newer upstream.

import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const SUITE = path.join(HERE, 'web-annotation-tests')
export const COMMIT = 'adedd9a5f06d9daa75bbfbb97aa9215cd09b4bb5'
const tarballURL = commit => `https://codeload.github.com/w3c/web-annotation-tests/tar.gz/${commit}`

export function suiteReady(dir = SUITE) {
  return existsSync(path.join(dir, 'definitions')) && existsSync(path.join(dir, 'annotations', 'annotationMusts.test'))
}

// Minimal ustar extractor (gunzip + 512-byte records) so we need no tar dependency. Joins the
// name/prefix split GitHub uses for long paths; skips pax/global headers and non-file entries.
function extractTarGz(gz, destDir) {
  const tar = gunzipSync(gz)
  for (let off = 0; off + 512 <= tar.length; ) {
    const h = tar.subarray(off, off + 512)
    off += 512
    if (h.every(b => b === 0)) break
    const field = (s, e) => h.toString('utf8', s, e).replace(/\0.*$/s, '')
    const name = field(0, 100)
    const size = parseInt(field(124, 136).trim() || '0', 8) || 0
    const type = String.fromCharCode(h[156])
    const prefix = field(345, 500)
    const data = tar.subarray(off, off + size)
    off += Math.ceil(size / 512) * 512
    if (type !== '0' && type !== '\0' && type !== '') continue
    const rel = ((prefix ? prefix + '/' : '') + name).replace(/^[^/]+\//, '') // strip web-annotation-tests-<sha>/
    if (!rel) continue
    // Only what the conformance test reads; skip upstream repo chrome (README, tools/, collections/)
    // and stray dotfiles (.gitignore/.editorconfig).
    if (!/^(definitions|annotations)\//.test(rel) || rel.split('/').some(seg => seg.startsWith('.'))) continue
    const target = path.join(destDir, rel)
    mkdirSync(path.dirname(target), { recursive: true })
    writeFileSync(target, data)
  }
}

// Reuse the cache when it already matches COMMIT; otherwise pull fresh from GitHub. If the network
// is down, fall back to any cached copy, else return false (caller skips the conformance suite).
export async function ensureSuite(dir = SUITE, commit = COMMIT) {
  const marker = path.join(dir, '.commit')
  const fresh = suiteReady(dir) && existsSync(marker) && readFileSync(marker, 'utf8').trim() === commit
  if (fresh) return true
  try {
    const res = await fetch(tarballURL(commit))
    if (res.ok) {
      rmSync(dir, { recursive: true, force: true })
      extractTarGz(Buffer.from(await res.arrayBuffer()), dir)
      writeFileSync(marker, commit)
      return suiteReady(dir)
    }
  } catch { /* offline: fall back to a cached copy if present */ }
  return suiteReady(dir)
}
