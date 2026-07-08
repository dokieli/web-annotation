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

import { describe, it, expect } from 'vitest'
import { parseStoredAnnotation, parseAnnotation } from '../src/parse.js'
import { createAnnotation } from '../src/annotation.js'
import { serializeAnnotationToJSONLD } from '../src/jsonld.js'

const OA = 'http://www.w3.org/ns/oa#'
const RDF_VALUE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#value'
const DCTERMS = 'http://purl.org/dc/terms/'

function annotationNode(extra = {}) {
  return {
    '@id': 'https://example.org/annotations/1',
    '@type': [`${OA}Annotation`],
    [`${OA}motivatedBy`]: { '@id': `${OA}replying` },
    [`${OA}hasTarget`]: { '@id': 'https://example.org/doc#target' },
    [`${DCTERMS}created`]: '2026-01-01T00:00:00Z',
    ...extra,
  }
}

function targetNode(selectorId, extra = {}) {
  return {
    '@id': 'https://example.org/doc#target',
    [`${OA}hasSource`]: { '@id': 'https://example.org/doc' },
    ...(selectorId && { [`${OA}hasSelector`]: { '@id': selectorId } }),
    ...extra,
  }
}

describe('parseStoredAnnotation', () => {
  it('returns null for a graph without an annotation node', () => {
    expect(parseStoredAnnotation([{ '@id': 'x', '@type': ['Other'] }])).toBeNull()
  })

  it('returns null when the annotation has no target', () => {
    const graph = [{ '@id': 'a', '@type': [`${OA}Annotation`], [`${OA}motivatedBy`]: { '@id': `${OA}replying` } }]
    expect(parseStoredAnnotation(graph)).toBeNull()
  })

  it('parses motivation directly, including unknown motivations', () => {
    const graph = [
      annotationNode({ [`${OA}motivatedBy`]: { '@id': `${OA}classifying` } }),
      targetNode(),
    ]
    const a = parseStoredAnnotation(graph)
    expect(a).not.toBeNull()
    expect(a.motivatedBy).toBe(`${OA}classifying`)
  })

  it('resolves a flat TextQuoteSelector', () => {
    const graph = [
      annotationNode(),
      targetNode('_:tq'),
      {
        '@id': '_:tq',
        '@type': [`${OA}TextQuoteSelector`],
        [`${OA}exact`]: 'web annotations',
        [`${OA}prefix`]: 'using ',
        [`${OA}suffix`]: ' here',
      },
    ]
    const a = parseStoredAnnotation(graph)
    expect(a.target.selector).toEqual({
      type: 'TextQuoteSelector',
      exact: 'web annotations',
      prefix: 'using ',
      suffix: ' here',
    })
  })

  it('resolves a nested FragmentSelector -> refinedBy -> TextQuoteSelector', () => {
    const graph = [
      annotationNode(),
      targetNode('_:frag'),
      {
        '@id': '_:frag',
        '@type': [`${OA}FragmentSelector`],
        [RDF_VALUE]: 'char=0,10',
        [`${DCTERMS}conformsTo`]: { '@id': 'https://tools.ietf.org/html/rfc3987' },
        [`${OA}refinedBy`]: { '@id': '_:tq' },
      },
      { '@id': '_:tq', '@type': [`${OA}TextQuoteSelector`], [`${OA}exact`]: 'linked data' },
    ]
    const a = parseStoredAnnotation(graph)
    expect(a.target.selector.type).toBe('FragmentSelector')
    expect(a.target.selector.value).toBe('char=0,10')
    expect(a.target.selector.conformsTo).toBe('https://tools.ietf.org/html/rfc3987')
    expect(a.target.selector.refinedBy).toEqual({ type: 'TextQuoteSelector', exact: 'linked data', prefix: '', suffix: '' })
  })

  it('resolves a TextPositionSelector', () => {
    const graph = [
      annotationNode(),
      targetNode('_:tp'),
      { '@id': '_:tp', '@type': [`${OA}TextPositionSelector`], [`${OA}start`]: '12', [`${OA}end`]: '20' },
    ]
    const a = parseStoredAnnotation(graph)
    expect(a.target.selector).toEqual({ type: 'TextPositionSelector', start: 12, end: 20 })
  })

  it('resolves an XPathSelector', () => {
    const graph = [
      annotationNode(),
      targetNode('_:xp'),
      { '@id': '_:xp', '@type': [`${OA}XPathSelector`], [RDF_VALUE]: '/html/body/p[2]' },
    ]
    const a = parseStoredAnnotation(graph)
    expect(a.target.selector).toEqual({ type: 'XPathSelector', value: '/html/body/p[2]' })
  })

  it('resolves a RangeSelector', () => {
    const graph = [
      annotationNode(),
      targetNode('_:range'),
      {
        '@id': '_:range',
        '@type': [`${OA}RangeSelector`],
        [`${OA}hasStartSelector`]: { '@id': '_:s' },
        [`${OA}hasEndSelector`]: { '@id': '_:e' },
      },
      { '@id': '_:s', '@type': [`${OA}XPathSelector`], [RDF_VALUE]: '/p[1]' },
      { '@id': '_:e', '@type': [`${OA}XPathSelector`], [RDF_VALUE]: '/p[2]' },
    ]
    const a = parseStoredAnnotation(graph)
    expect(a.target.selector).toEqual({
      type: 'RangeSelector',
      startSelector: { type: 'XPathSelector', value: '/p[1]' },
      endSelector: { type: 'XPathSelector', value: '/p[2]' },
    })
  })

  it('resolves a TimeState', () => {
    const graph = [
      annotationNode(),
      targetNode(null, { [`${OA}hasState`]: { '@id': '_:state' } }),
      {
        '@id': '_:state',
        '@type': [`${OA}TimeState`],
        [`${OA}sourceDate`]: '2024-01-01T00:00:00Z',
        [`${OA}cachedSource`]: { '@id': 'https://web.archive.org/x' },
      },
    ]
    const a = parseStoredAnnotation(graph)
    expect(a.target.state).toEqual({
      type: 'TimeState',
      sourceDate: '2024-01-01T00:00:00Z',
      cached: 'https://web.archive.org/x',
    })
  })

  it('extracts the body value', () => {
    const graph = [
      annotationNode({ [`${OA}hasBody`]: { '@id': '_:body' } }),
      targetNode(),
      { '@id': '_:body', [RDF_VALUE]: 'Great point.' },
    ]
    const a = parseStoredAnnotation(graph)
    expect(a.body).toEqual([{ value: 'Great point.' }])
  })
})

// RDF-derived JSON-LD is often non-flattened: one object per quad, so a subject's properties scatter across same-@id objects that parseStoredAnnotation must consolidate.
describe('parseStoredAnnotation (per-quad, non-flattened JSON-LD)', () => {
  // Explode a flattened node graph into one object per property (per-quad form).
  function explodePerQuad(graph) {
    const out = []
    for (const node of graph) {
      const id = node['@id']
      for (const [k, v] of Object.entries(node)) {
        if (k === '@id') continue
        out.push({ '@id': id, [k]: v })
      }
    }
    return out
  }

  const flat = [
    annotationNode({ [`${OA}hasBody`]: { '@id': '_:body' } }),
    targetNode('_:tq'),
    { '@id': '_:tq', '@type': [`${OA}TextQuoteSelector`], [`${OA}exact`]: 'linked data', [`${OA}prefix`]: 'using ' },
    { '@id': '_:body', [RDF_VALUE]: 'Great point.' },
  ]

  it('consolidates same-@id objects so the annotation and its selector resolve', () => {
    const exploded = explodePerQuad(flat)
    // Sanity: each subject is split across multiple objects.
    expect(exploded.length).toBeGreaterThan(flat.length)

    const a = parseStoredAnnotation(exploded)
    expect(a).not.toBeNull()
    expect(a.motivatedBy).toBe(`${OA}replying`)
    expect(a.target.selector).toMatchObject({ type: 'TextQuoteSelector', exact: 'linked data', prefix: 'using ' })
    expect(a.body).toEqual([{ value: 'Great point.' }])
  })

  it('merges a multi-valued predicate (e.g. two @type quads) into the type set', () => {
    const exploded = [
      { '@id': 'a', '@type': `${OA}Annotation` },
      { '@id': 'a', '@type': 'http://www.w3.org/ns/ldp#Resource' },
      { '@id': 'a', [`${OA}motivatedBy`]: { '@id': `${OA}replying` } },
      { '@id': 'a', [`${OA}hasTarget`]: { '@id': 'a-t' } },
      { '@id': 'a-t', [`${OA}hasSource`]: { '@id': 'https://example.org/doc' } },
    ]
    const a = parseStoredAnnotation(exploded, 'a')
    expect(a).not.toBeNull()
    expect(a.target.source).toBe('https://example.org/doc')
  })
})

describe('parseAnnotation (caller-supplied parser)', () => {
  const graph = [
    annotationNode(),
    targetNode('_:tq'),
    { '@id': '_:tq', '@type': [`${OA}TextQuoteSelector`], [`${OA}exact`]: 'linked data' },
  ]

  it('throws when no parser is provided', async () => {
    await expect(parseAnnotation({}, {})).rejects.toThrow('a `parser` is required')
    await expect(parseAnnotation({})).rejects.toThrow('a `parser` is required')
  })

  it('delegates normalization to a sync parser, then maps to an Annotation', async () => {
    const parser = (input) => input // input is already a flat node array
    const a = await parseAnnotation(graph, { parser })
    expect(a.motivatedBy).toBe(`${OA}replying`)
    expect(a.target.selector).toMatchObject({ type: 'TextQuoteSelector', exact: 'linked data' })
  })

  it('awaits an async parser', async () => {
    const parser = async (input) => { return input }
    const a = await parseAnnotation('raw-json-ld-string', { parser: () => Promise.resolve(graph) })
    expect(a).not.toBeNull()
    expect(a.motivatedBy).toBe(`${OA}replying`)
  })

  it('passes annotationIRI through to parseStoredAnnotation', async () => {
    const a = await parseAnnotation(graph, { parser: (i) => i, annotationIRI: 'https://example.org/annotations/1' })
    expect(a.iri).toBe('https://example.org/annotations/1')
  })

  it('returns null when the parser yields no annotation node', async () => {
    const a = await parseAnnotation('x', { parser: () => [{ '@id': 'x', '@type': ['Other'] }] })
    expect(a).toBeNull()
  })
})

describe('parseStoredAnnotation (compact / non-expanded JSON-LD)', () => {
  it('parses a single compact WA-context annotation object (short keys, embedded nodes)', () => {
    const compact = {
      '@context': 'http://www.w3.org/ns/anno.jsonld',
      id: 'https://example.org/annotations/1',
      type: 'Annotation',
      motivation: 'replying',
      created: '2026-01-01T00:00:00Z',
      creator: { id: 'https://alice.example/#me', type: 'Person', name: 'Alice' },
      body: { type: 'TextualBody', value: 'Great point.' },
      target: {
        source: 'https://example.org/paper',
        selector: { type: 'TextQuoteSelector', exact: 'web annotations', prefix: 'using ', suffix: ' here' },
      },
    }
    const a = parseStoredAnnotation(compact)
    expect(a).not.toBeNull()
    expect(a.motivatedBy).toBe('oa:replying')
    expect(a.iri).toBe('https://example.org/annotations/1')
    expect(a.creator).toMatchObject({ iri: 'https://alice.example/#me', name: 'Alice' })
    expect(a.body).toEqual([{ value: 'Great point.' }])
    expect(a.target.source).toBe('https://example.org/paper')
    expect(a.target.selector).toEqual({
      type: 'TextQuoteSelector', exact: 'web annotations', prefix: 'using ', suffix: ' here',
    })
  })

  it('parses a compact embedded TimeState and FragmentSelector', () => {
    const a = parseStoredAnnotation({
      '@context': 'http://www.w3.org/ns/anno.jsonld',
      id: 'urn:x', type: 'Annotation', motivation: 'commenting',
      target: {
        source: 'https://example.org/p',
        selector: { type: 'FragmentSelector', value: 'char=0,5', refinedBy: { type: 'TextQuoteSelector', exact: 'hello' } },
        state: { type: 'TimeState', sourceDate: '2024-01-01T00:00:00Z', cached: 'https://web.archive.org/x' },
      },
    })
    expect(a.target.selector.type).toBe('FragmentSelector')
    expect(a.target.selector.refinedBy).toMatchObject({ type: 'TextQuoteSelector', exact: 'hello' })
    expect(a.target.state).toMatchObject({ type: 'TimeState', cached: 'https://web.archive.org/x' })
  })

  it('parses a compact target given as a bare IRI string', () => {
    const a = parseStoredAnnotation({
      '@context': 'http://www.w3.org/ns/anno.jsonld',
      id: 'urn:y', type: 'Annotation', motivation: 'bookmarking',
      target: 'https://example.org/doc',
    })
    expect(a.target.iri).toBe('https://example.org/doc')
    expect(a.target.selector).toBeUndefined()
  })

  it('round-trips a TimeState interval (sourceDateStart/sourceDateEnd) through JSON-LD', () => {
    const original = createAnnotation({
      motivatedBy: 'oa:replying', id: 'ts1',
      target: {
        iri: 'https://example.org/p#s', source: 'https://example.org/p',
        selector: { type: 'TextQuoteSelector', exact: 'x' },
        state: { type: 'TimeState', sourceDateStart: '2024-01-01T00:00:00Z', sourceDateEnd: '2024-12-31T23:59:59Z' },
      },
      body: { content: 'note' },
    })

    const ld = serializeAnnotationToJSONLD(original)
    expect(ld.target.state).toMatchObject({
      type: 'TimeState',
      sourceDateStart: '2024-01-01T00:00:00Z',
      sourceDateEnd: '2024-12-31T23:59:59Z',
    })

    const parsed = parseStoredAnnotation(ld)
    expect(parsed.target.state).toEqual({
      type: 'TimeState',
      id: original.target.state.id,   // node id round-trips
      sourceDateStart: '2024-01-01T00:00:00Z',
      sourceDateEnd: '2024-12-31T23:59:59Z',
    })
  })

  it('round-trips createAnnotation -> serializeAnnotationToJSONLD -> parseStoredAnnotation', () => {
    const original = createAnnotation({
      motivatedBy: 'oa:replying',
      id: 'rt1',
      datetime: '2026-01-01T00:00:00.000Z',
      target: {
        iri: 'https://example.org/p#s', source: 'https://example.org/p',
        selector: { type: 'TextQuoteSelector', exact: 'web annotations', prefix: 'using ', suffix: ' here' },
      },
      body: { content: 'Nice.' },
      creator: { iri: 'https://alice.example/#me', name: 'Alice' },
    })

    const ld = serializeAnnotationToJSONLD(original)   // compact WA JSON-LD
    const parsed = parseStoredAnnotation(ld)            // reads its own output

    expect(parsed).not.toBeNull()
    expect(parsed.motivatedBy).toBe('oa:replying')
    expect(parsed.body[0].value).toBe('Nice.')
    expect(parsed.target.source).toBe('https://example.org/p')
    expect(parsed.target.selector).toEqual({
      type: 'TextQuoteSelector', id: original.target.selector.id, exact: 'web annotations', prefix: 'using ', suffix: ' here',
    })
  })
})

describe('round-trip: body shapes survive serialize -> parse (JSON-LD)', () => {
  it('preserves a plain bodyValue', () => {
    const a = createAnnotation({
      motivatedBy: `${OA}commenting`,
      id: 'rt-1',
      target: { iri: 'https://example.org/#x', source: 'https://example.org/' },
    })
    a.body = []
    a.bodyValue = 'plain note'
    const back = parseStoredAnnotation(serializeAnnotationToJSONLD(a))
    expect(back.bodyValue).toBe('plain note')
  })

  it('preserves a TextualBody with language + license metadata', () => {
    const a = createAnnotation({
      motivatedBy: `${OA}commenting`,
      id: 'rt-2',
      target: { iri: 'https://example.org/#y', source: 'https://example.org/' },
      body: { content: 'rich note', language: 'en', license: 'https://creativecommons.org/licenses/by/4.0/' },
    })
    const back = parseStoredAnnotation(serializeAnnotationToJSONLD(a))
    expect(back.body[0].value).toBe('rich note')
    expect(back.body[0].language).toBe('en')
  })
})
