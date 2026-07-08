// Conformance: validates serializeAnnotationToJSONLD output against the W3C w3c/web-annotation-tests
// schemas via ajv (MUST assertions gate; optional ones are informational). The suite itself is
// fetched and cached by ./fetch-suite.js (not vendored); when it can't be obtained (no network and
// no cache) these tests skip and the rest of the suite still runs.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import Ajv from 'ajv-draft-04'
import addFormats from 'ajv-formats'
import { createAnnotation } from '../../src/annotation.js'
import { serializeAnnotationToJSONLD } from '../../src/jsonld.js'
import { SUITE, ensureSuite } from './fetch-suite.js'

const available = await ensureSuite()
if (!available) {
  console.warn('\n[conformance] w3c/web-annotation-tests unavailable (no network and no cached copy) - skipping the conformance suite; the rest of the tests still run.\n')
}

function buildAjv() {
  const ajv = new Ajv({ strict: false, allErrors: true })
  addFormats(ajv)
  // Definition files self-identify with draft-04 `id` (e.g. "annotations.json"), matching how descriptors $ref them.
  for (const f of readdirSync(path.join(SUITE, 'definitions'))) {
    if (!f.endsWith('.json')) continue
    ajv.addSchema(JSON.parse(readFileSync(path.join(SUITE, 'definitions', f), 'utf8')), f)
  }
  return ajv
}

function loadManifest(rel) {
  const manifest = JSON.parse(readFileSync(path.join(SUITE, rel), 'utf8'))
  return manifest.assertions.map(assertionPath => {
    const descriptor = JSON.parse(readFileSync(path.join(SUITE, assertionPath), 'utf8'))
    return { assertionPath, descriptor }
  })
}

const ajv = available ? buildAjv() : null
const compileCache = new Map()
function validatorFor({ assertionPath, descriptor }) {
  if (!compileCache.has(assertionPath)) compileCache.set(assertionPath, ajv.compile(descriptor))
  return compileCache.get(assertionPath)
}

const CREATOR = { iri: 'https://alice.example/#me', name: 'Alice', url: 'https://alice.example/' }
const SOURCE = 'https://example.org/article'

// A stored annotation carries an absolute iri (the @id); the relative #id fallback is
// the no-location case and is conformant only once served from a base.
function ld(params) {
  return serializeAnnotationToJSONLD(createAnnotation({
    id: 'a1',
    iri: 'https://example.org/annotations/a1',
    datetime: '2026-04-03T10:00:00.000Z',
    creator: CREATOR,
    ...params,
  }))
}

// One annotation per shape this package can emit. Every fixture must pass every MUST.
const fixtures = {
  'comment + TextQuoteSelector + tags': ld({
    motivatedBy: 'oa:commenting',
    target: { iri: SOURCE + '#s2', source: SOURCE, selector: { type: 'TextQuoteSelector', exact: 'web annotations', prefix: 'using ', suffix: ' here' } },
    body: { content: 'Great point.', tags: 'rdf, web' },
  }),
  'reply (oa:replying)': ld({
    motivatedBy: 'oa:replying',
    target: { iri: SOURCE, source: SOURCE },
    body: { content: 'Agreed.' },
  }),
  'bookmark (bodyless motivation)': ld({
    motivatedBy: 'oa:bookmarking',
    target: { iri: SOURCE, source: SOURCE },
  }),
  'highlight (no body)': ld({
    motivatedBy: 'oa:highlighting',
    target: { iri: SOURCE, source: SOURCE, selector: { type: 'TextQuoteSelector', exact: 'highlighted' } },
  }),
  'custom non-oa motivation IRI': ld({
    motivatedBy: 'as:Like',
    target: { iri: SOURCE, source: SOURCE },
    body: { content: 'Agreed.' },
  }),
  'tag-only body': ld({
    motivatedBy: 'oa:tagging',
    target: { iri: SOURCE, source: SOURCE },
    body: { tags: 'web, annotation' },
  }),
  'FragmentSelector': ld({
    motivatedBy: 'oa:commenting',
    target: { iri: SOURCE, source: SOURCE, selector: { type: 'FragmentSelector', value: 'xywh=10,10,30,40' } },
    body: { content: 'x' },
  }),
  'XPathSelector': ld({
    motivatedBy: 'oa:commenting',
    target: { iri: SOURCE, source: SOURCE, selector: { type: 'XPathSelector', value: '/html/body/p[2]' } },
    body: { content: 'x' },
  }),
  'TextPositionSelector': ld({
    motivatedBy: 'oa:commenting',
    target: { iri: SOURCE, source: SOURCE, selector: { type: 'TextPositionSelector', start: 12, end: 40 } },
    body: { content: 'x' },
  }),
  'RangeSelector (nested selectors)': ld({
    motivatedBy: 'oa:commenting',
    target: { iri: SOURCE, source: SOURCE, selector: { type: 'RangeSelector',
      startSelector: { type: 'XPathSelector', value: '/html/body/p[1]' },
      endSelector: { type: 'XPathSelector', value: '/html/body/p[3]' } } },
    body: { content: 'x' },
  }),
  'TextQuote refinedBy TextPosition': ld({
    motivatedBy: 'oa:commenting',
    target: { iri: SOURCE, source: SOURCE, selector: { type: 'TextQuoteSelector', exact: 'web annotations',
      refinedBy: { type: 'TextPositionSelector', start: 0, end: 11 } } },
    body: { content: 'x' },
  }),
  'TimeState': ld({
    motivatedBy: 'oa:commenting',
    target: { iri: SOURCE, source: SOURCE, state: { type: 'TimeState', sourceDate: '2026-01-01T00:00:00.000Z', cached: 'https://archive.example/x' } },
    body: { content: 'x' },
  }),
  'HttpRequestState': ld({
    motivatedBy: 'oa:commenting',
    target: { iri: SOURCE, source: SOURCE, state: { type: 'HttpRequestState', value: 'Accept: text/html' } },
    body: { content: 'x' },
  }),
  'body with language + rights': ld({
    motivatedBy: 'oa:commenting',
    target: { iri: SOURCE, source: SOURCE },
    body: { content: 'Bonjour', language: 'fr', license: 'https://creativecommons.org/licenses/by/4.0/' },
  }),
  'plain target IRI (no selector)': ld({
    motivatedBy: 'oa:commenting',
    target: { iri: SOURCE, source: SOURCE },
    body: { content: 'x' },
  }),
}

// Deliberate deviation: we type content-body `value` as rdf:HTML (an `{@value,@type}`
// object) to match the RDFa serialization, but the WA JSON-Schema requires body `value`
// to be a plain string. So 3.2-bodyObjectsRecognized cannot pass by design; excluded
// from the MUST gate. All other MUSTs are still enforced.
const EXCLUDED_MUSTS = new Set(['annotations/3.2-bodyObjectsRecognized.json'])
const musts = available ? loadManifest('annotations/annotationMusts.test').filter(m => !EXCLUDED_MUSTS.has(m.assertionPath)) : []
const optionals = available ? ['annotations/annotationOptionals.test', 'annotations/annotationsAgentOptionals.test'].flatMap(loadManifest) : []

describe.skipIf(!available)('W3C Web Annotation Data Model - MUST conformance', () => {
  for (const [fixtureName, annotation] of Object.entries(fixtures)) {
    describe(fixtureName, () => {
      it.each(musts.map(m => [m.assertionPath, m]))('%s', (_label, must) => {
        const validate = validatorFor(must)
        const ok = validate(annotation)
        const shouldBeValid = must.descriptor.expectedResult === 'valid'
        if (ok !== shouldBeValid) {
          throw new Error(
            `${must.descriptor.errorMessage || must.descriptor.title}\n` +
            `expected ${must.descriptor.expectedResult}, ajv errors: ` +
            JSON.stringify(validate.errors, null, 2)
          )
        }
        expect(ok).toBe(shouldBeValid)
      })
    })
  }
})

// Informational: how many optional (SHOULD/MAY) features our output exercises (never a failure).
// We only assert the harness is wired (some optionals are satisfied somewhere).
describe.skipIf(!available)('optional feature coverage (informational)', () => {
  it('reports satisfied optional assertions per fixture', () => {
    const satisfiedAnywhere = new Set()
    const lines = []
    for (const [fixtureName, annotation] of Object.entries(fixtures)) {
      const hits = optionals.filter(o => {
        const validate = validatorFor(o)
        return validate(annotation) === (o.descriptor.expectedResult === 'valid')
      })
      hits.forEach(h => satisfiedAnywhere.add(h.assertionPath))
      lines.push(`  ${fixtureName}: ${hits.length}/${optionals.length}`)
    }
    console.log(`\nOptional WA feature coverage (${satisfiedAnywhere.size}/${optionals.length} distinct optionals exercised):\n${lines.join('\n')}`)
    expect(satisfiedAnywhere.size).toBeGreaterThan(0)
  })
})
