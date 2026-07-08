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

// RDFa and JSON-LD must serialize the same annotation to equivalent graphs.
// Serialize a complex annotation both ways, parse each back through the library's
// own parser, and compare the resulting models. Comparing models (not raw triples)
// ignores representation noise (datatypes, prefixed-vs-full IRIs, node ids) while
// catching real structural/vocabulary divergence.
// Needs rdfa-streaming-parser (devDependency); the suite skips this if it's absent.
import { describe, it, expect } from 'vitest'
import { createAnnotation } from '../src/annotation.js'
import { serializeAnnotation } from '../src/serialize.js'
import { serializeAnnotationToJSONLD } from '../src/jsonld.js'
import { parseStoredAnnotation } from '../src/parse.js'

let RdfaParser
// Variable specifier + @vite-ignore so a missing optional dep is a catchable runtime
// error (the tests below skip) rather than a hard Vite resolve failure.
try {
  const mod = 'rdfa-streaming-parser'
  ;({ RdfaParser } = await import(/* @vite-ignore */ mod))
} catch { /* not installed: tests below are skipped */ }

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
const PREFIXES = {
  'oa:': 'http://www.w3.org/ns/oa#',
  'as:': 'https://www.w3.org/ns/activitystreams#',
  'schema:': 'http://schema.org/',
  'foaf:': 'http://xmlns.com/foaf/0.1/',
  'dcterms:': 'http://purl.org/dc/terms/',
  'dc:': 'http://purl.org/dc/elements/1.1/',
}

// Prefixed IRI -> full IRI (the RDFa parser expands prefixes; the JSON-LD path keeps them compact).
function expand(value) {
  if (typeof value !== 'string') return value
  for (const [prefix, ns] of Object.entries(PREFIXES)) {
    if (value.startsWith(prefix)) return ns + value.slice(prefix.length)
  }
  return value
}

// rdfa-streaming-parser quads -> the flat node graph parseStoredAnnotation consumes.
function quadsToGraph(quads) {
  const bySubject = new Map()
  for (const q of quads) {
    const subject = q.subject.value
    if (!bySubject.has(subject)) bySubject.set(subject, { '@id': subject })
    const node = bySubject.get(subject)
    const key = q.predicate.value === RDF_TYPE ? '@type' : q.predicate.value
    const object = q.object.termType === 'Literal'
      ? { '@value': q.object.value, ...(q.object.language && { '@language': q.object.language }) }
      : { '@id': q.object.value }
    node[key] = key in node ? [].concat(node[key], object) : object
  }
  return [...bySubject.values()]
}

async function rdfaToGraph(html, base) {
  const doc = `<!DOCTYPE html><html><head><base href="${base}"></head><body>${html}</body></html>`
  const quads = []
  await new Promise((resolve, reject) => {
    const parser = new RdfaParser({ baseIRI: base, contentType: 'text/html' })
    parser.on('data', q => quads.push(q))
    parser.on('error', reject)
    parser.on('end', resolve)
    parser.write(doc)
    parser.end()
  })
  return quadsToGraph(quads)
}

// Drop volatile node ids, expand prefixed IRIs, sort arrays: structural/value equivalence.
function normalize(value) {
  if (Array.isArray(value)) {
    return value.map(normalize).sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1))
  }
  if (value && typeof value === 'object') {
    const out = {}
    for (const key of Object.keys(value).sort()) {
      if (key === 'id') continue
      out[key] = normalize(value[key])
    }
    return out
  }
  return expand(value)
}

// A rich annotation in the shape the example app emits: cross-element RangeSelector
// (XPath start/end each refined by a TextQuote with its own language + a TextPosition),
// SpecificResource target with renderedVia, note body (with format + language) and tags.
function complexAnnotation() {
  return createAnnotation({
    motivatedBy: 'oa:commenting',
    id: 'a1',
    iri: 'https://example.org/annotations/a1',
    datetime: '2026-04-03T10:00:00.000Z',
    target: {
      iri: 'https://example.org/article#s2',
      source: 'https://example.org/article',
      renderedVia: { iri: 'https://dokie.li/#i', name: 'dokieli' },
      selector: {
        type: 'RangeSelector',
        startSelector: {
          type: 'XPathSelector', value: '/html/body/p[1]',
          refinedBy: [
            { type: 'TextQuoteSelector', exact: 'web annotations', prefix: 'using ', suffix: '', language: 'de' },
            { type: 'TextPositionSelector', start: 10, end: 21 },
          ],
        },
        endSelector: {
          type: 'XPathSelector', value: '/html/body/p[3]',
          refinedBy: [
            { type: 'TextQuoteSelector', exact: 'selectors', prefix: '', suffix: ' here', language: 'en' },
            { type: 'TextPositionSelector', start: 40, end: 49 },
          ],
        },
      },
    },
    // Plain text: HTML markup in the body does not round-trip identically yet
    // (RDFa rdf:value yields text content, JSON-LD keeps the raw string).
    // license sets annotation + body license (rights is independent now); inboxIRI drives ldp:inbox.
    body: { content: 'A plain note.', tags: 'rdf, web', language: 'en', license: 'https://creativecommons.org/licenses/by/4.0/' },
    creator: { iri: 'https://alice.example/#me', name: 'Alice', url: 'https://alice.example/', inboxIRI: 'https://example.org/inbox' },
  })
}

describe.skipIf(!RdfaParser)('RDFa and JSON-LD serialize to equivalent graphs', () => {
  it('a complex RangeSelector annotation parses back identically from both serializations', async () => {
    const annotation = complexAnnotation()
    const fromJSONLD = parseStoredAnnotation([serializeAnnotationToJSONLD(annotation)])
    const fromRDFa = parseStoredAnnotation(
      await rdfaToGraph(serializeAnnotation(annotation, { format: 'rdfa' }), 'https://example.org/')
    )
    expect(normalize(fromRDFa)).toEqual(normalize(fromJSONLD))
  })
})
