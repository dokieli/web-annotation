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
import { createAnnotation } from '../src/annotation.js'
import { serializeAnnotationToJSONLD, WEB_ANNOTATION_CONTEXT } from '../src/jsonld.js'
import { serializeAnnotation } from '../src/serialize.js'

function make(overrides = {}) {
  return createAnnotation({
    motivatedBy: 'oa:replying',
    id: 'a1',
    datetime: '2026-04-03T10:00:00.000Z',
    target: {
      iri: 'https://example.org/paper#s2',
      source: 'https://example.org/paper',
      selector: { type: 'TextQuoteSelector', exact: 'web annotations', prefix: 'using ', suffix: ' here' },
    },
    body: { content: 'Great point.', tags: 'rdf, web' },
    creator: { iri: 'https://alice.example/#me', name: 'Alice', url: 'https://alice.example/' },
    ...overrides,
  })
}

describe('serializeAnnotationToJSONLD', () => {
  it('produces a conformant Annotation with the WA context', () => {
    const ld = serializeAnnotationToJSONLD(make())
    expect(ld['@context']).toBe(WEB_ANNOTATION_CONTEXT)
    expect(ld.type).toBe('Annotation')
    // No iri: @id is a relative #id fragment (never urn); the urn lives only in oa:canonical.
    expect(ld.id).toBe('#a1')
    expect(ld.canonical).toBe('urn:uuid:a1')
    expect(ld.created).toBe('2026-04-03T10:00:00.000Z')
  })

  it('emits the supplied iri as @id (incl. a relative "" resolved at storage), urn always in oa:canonical', () => {
    // No iri: @id is the relative #id fragment, never urn.
    expect(serializeAnnotationToJSONLD(make()).id).toBe('#a1')

    // Explicit relative '' (dokieli posts this; resolves to the storage URL).
    const ldRel = serializeAnnotationToJSONLD({ ...make(), iri: '' })
    expect(ldRel.id).toBe('')
    expect(ldRel.canonical).toBe('urn:uuid:a1')

    // A known storage IRI is emitted verbatim.
    const ld2 = serializeAnnotationToJSONLD({ ...make(), iri: 'https://store.example/anno/1' })
    expect(ld2.id).toBe('https://store.example/anno/1')
    expect(ld2.canonical).toBe('urn:uuid:a1')
  })

  it('maps oa motivations to short WA tokens', () => {
    expect(serializeAnnotationToJSONLD(make()).motivation).toBe('replying')
    expect(serializeAnnotationToJSONLD(make({ motivatedBy: 'oa:assessing', body: { content: 'x' } })).motivation).toBe('assessing')
  })

  it('expands non-oa motivations to a full IRI', () => {
    const ld = serializeAnnotationToJSONLD(make({ motivatedBy: 'as:Like', body: { content: 'x' } }))
    expect(ld.motivation).toBe('https://www.w3.org/ns/activitystreams#Like')
  })

  it('renders the creator without a type unless one is supplied', () => {
    const c = serializeAnnotationToJSONLD(make()).creator
    expect(c).toMatchObject({ id: 'https://alice.example/#me', name: 'Alice' })
    expect(c.type).toBeUndefined()
  })

  it('emits the supplied creator type (compacted)', () => {
    const c = serializeAnnotationToJSONLD(make({ creator: { iri: 'https://alice.example/#me', name: 'Alice', type: 'http://xmlns.com/foaf/0.1/Person' } })).creator
    expect(c.type).toBe('foaf:Person')
  })

  it('renders bodies as TextualBody (content + tags)', () => {
    const ld = serializeAnnotationToJSONLD(make())
    expect(Array.isArray(ld.body)).toBe(true)
    // Content body value is typed rdf:HTML (matches the RDFa); tags stay plain.
    expect(ld.body[0]).toMatchObject({ type: 'TextualBody', value: { '@value': 'Great point.', '@type': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#HTML' } })
    const tags = ld.body.filter(b => b.purpose === 'tagging').map(b => b.value).sort()
    expect(tags).toEqual(['rdf', 'web'])
  })

  it('renders a single body as an object, not an array', () => {
    const ld = serializeAnnotationToJSONLD(make({ body: { content: 'Solo.' } }))
    expect(ld.body).toMatchObject({ type: 'TextualBody', value: { '@value': 'Solo.', '@type': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#HTML' } })
  })

  it('emits #<uuid> ids that match the model node ids (RDFa @resource parity)', () => {
    const ann = make()
    const ld = serializeAnnotationToJSONLD(ann)
    const noteBody = ann.body.find(b => b.value === 'Great point.')
    const tagBody = ann.body.find(b => b.value === 'rdf')
    expect(ld.body.find(b => b.value?.['@value'] === 'Great point.').id).toBe('#' + noteBody.id)
    expect(ld.body.find(b => b.value === 'rdf').id).toBe('#' + tagBody.id)
    expect(ld.target.selector.id).toBe('#' + ann.target.selector.id)
  })

  it('renders the target as a SpecificResource with the typed selector', () => {
    const ld = serializeAnnotationToJSONLD(make())
    expect(ld.target.type).toBe('SpecificResource')
    expect(ld.target.id).toBe('https://example.org/paper#s2')
    expect(ld.target.source).toBe('https://example.org/paper')
    expect(ld.target.selector).toEqual({
      id: expect.any(String),
      type: 'TextQuoteSelector',
      exact: 'web annotations',
      prefix: 'using ',
      suffix: ' here',
    })
  })

  it('serializes a nested FragmentSelector refinedBy TextQuote', () => {
    const ld = serializeAnnotationToJSONLD(make({
      target: {
        iri: 'https://example.org/p#s', source: 'https://example.org/p',
        selector: {
          type: 'FragmentSelector', value: 'char=0,10',
          refinedBy: { type: 'TextQuoteSelector', exact: 'hello' },
        },
      },
    }))
    expect(ld.target.selector.type).toBe('FragmentSelector')
    expect(ld.target.selector.conformsTo).toBe('https://tools.ietf.org/html/rfc3987')
    expect(ld.target.selector.refinedBy).toEqual({ id: expect.any(String), type: 'TextQuoteSelector', exact: 'hello', prefix: '', suffix: '' })
  })

  it('serializes a RangeSelector and a TimeState', () => {
    const ld = serializeAnnotationToJSONLD(make({
      target: {
        iri: 'https://example.org/p#s', source: 'https://example.org/p',
        selector: {
          type: 'RangeSelector',
          startSelector: { type: 'XPathSelector', value: '/p[1]' },
          endSelector: { type: 'XPathSelector', value: '/p[2]' },
        },
        state: { type: 'TimeState', sourceDate: '2024-01-01T00:00:00Z', cached: 'https://web.archive.org/x' },
      },
    }))
    expect(ld.target.selector.type).toBe('RangeSelector')
    expect(ld.target.selector.startSelector).toEqual({ id: expect.any(String), type: 'XPathSelector', value: '/p[1]' })
    expect(ld.target.state).toEqual({ id: expect.any(String), type: 'TimeState', sourceDate: '2024-01-01T00:00:00Z', cached: 'https://web.archive.org/x' })
  })

  it('renders a target with no selector as a plain IRI', () => {
    const ld = serializeAnnotationToJSONLD(make({
      target: { iri: 'https://example.org/doc', source: 'https://example.org/doc' },
    }))
    expect(ld.target).toBe('https://example.org/doc')
  })

})

describe('serializeAnnotation (format dispatch)', () => {
  it('defaults to a JSON-LD object', () => {
    const out = serializeAnnotation(make())
    expect(typeof out).toBe('object')
    expect(out.type).toBe('Annotation')
    expect(out['@context']).toBe(WEB_ANNOTATION_CONTEXT)
  })

  it("returns a JSON-LD object for format: 'jsonld'", () => {
    const out = serializeAnnotation(make(), { format: 'jsonld' })
    expect(typeof out).toBe('object')
    expect(out.type).toBe('Annotation')
    expect(out['@context']).toBe(WEB_ANNOTATION_CONTEXT)
  })

  it("treats 'html' as an alias for 'rdfa'", () => {
    expect(typeof serializeAnnotation(make(), { format: 'html' })).toBe('string')
  })
})
