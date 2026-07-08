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

// Web Annotation replacements: RDFa uses OA full property forms, JSON-LD uses compact WA keys.
import { describe, it, expect } from 'vitest'
import { createAnnotation } from '../src/annotation.js'
import { serializeAnnotation } from '../src/serialize.js'
import { serializeAnnotationToJSONLD } from '../src/jsonld.js'

// One annotation exercising every replacement the library emits.
function rich() {
  return createAnnotation({
    motivatedBy: 'oa:commenting',
    id: 'a1',
    datetime: '2026-04-03T10:00:00.000Z',
    target: {
      iri: 'https://example.org/article#s2',
      source: 'https://example.org/article',
      selector: {
        type: 'RangeSelector',
        startSelector: { type: 'XPathSelector', value: '/html/body/p[1]' },
        endSelector: { type: 'XPathSelector', value: '/html/body/p[3]' },
      },
      state: { type: 'TimeState', sourceDate: '2024-01-01T00:00:00.000Z', cached: 'https://web.archive.org/x' },
      renderedVia: { iri: 'https://dokie.li/#i', name: 'dokieli' },
    },
    body: { content: 'A note.', tags: 'rdf, web' },
    creator: { iri: 'https://alice.example/#me', name: 'Alice' },
  })
}

const rdfa = () => serializeAnnotation(rich(), { format: 'rdfa' })
const ld = () => serializeAnnotationToJSONLD(rich())

const SUPPORTED = [
  { oa: 'oa:motivatedBy',      key: 'motivation',    inLD: j => 'motivation' in j },
  { oa: 'oa:hasTarget',        key: 'target',        inLD: j => 'target' in j },
  { oa: 'oa:hasSource',        key: 'source',        inLD: j => 'source' in j.target },
  { oa: 'oa:hasSelector',      key: 'selector',      inLD: j => 'selector' in j.target },
  { oa: 'oa:hasStartSelector', key: 'startSelector', inLD: j => 'startSelector' in j.target.selector },
  { oa: 'oa:hasEndSelector',   key: 'endSelector',   inLD: j => 'endSelector' in j.target.selector },
  { oa: 'oa:hasBody',          key: 'body',          inLD: j => 'body' in j },
  { oa: 'oa:hasPurpose',       key: 'purpose',       inLD: j => j.body.some(b => 'purpose' in b) },
  { oa: 'oa:hasState',         key: 'state',         inLD: j => 'state' in j.target },
  { oa: 'oa:renderedVia',      key: 'renderedVia',   inLD: j => 'renderedVia' in j.target },
]

describe('RDFa uses the OA full property forms', () => {
  it.each(SUPPORTED)('$oa', ({ oa }) => {
    expect(rdfa()).toContain(oa)
  })
})

describe('JSON-LD uses the compact WA keys', () => {
  it.each(SUPPORTED)('$key', ({ inLD }) => {
    expect(inLD(ld())).toBe(true)
  })
})

describe('values are compacted, not just keys', () => {
  it('motivation: bare WA token in JSON-LD, oa: resource in RDFa', () => {
    expect(ld().motivation).toBe('commenting')
    expect(rdfa()).toContain('resource="oa:commenting"')
  })

  it('purpose: bare token in both serializations', () => {
    expect(ld().body.find(b => b.purpose)?.purpose).toBe('tagging')
    expect(rdfa()).toContain('resource="oa:tagging"')
  })
})

describe('cached (TimeState)', () => {
  it('JSON-LD uses the compact "cached" key', () => {
    expect(ld().target.state.cached).toBe('https://web.archive.org/x')
  })

  it('RDFa currently uses oa:cachedSource', () => {
    expect(rdfa()).toContain('rel="oa:cachedSource"')
  })
})

// Replacements not yet emitted.

/*
TODO: From http://www.w3.org/ns/anno.jsonld and dokieli/src/graph.js

  'http://www.w3.org/ns/oa#autoDirection': 'auto',
  'http://www.w3.org/ns/oa#cachedSource': 'cached',
  'http://www.w3.org/ns/oa#hasBody': 'body',
  'http://www.w3.org/ns/oa#hasEndSelector': 'endSelector',
  'http://www.w3.org/ns/oa#hasPurpose': 'purpose',
  'http://www.w3.org/ns/oa#hasScope': 'scope',
  'http://www.w3.org/ns/oa#hasSelector': 'selector',
  'http://www.w3.org/ns/oa#hasSource': 'source',
  'http://www.w3.org/ns/oa#hasStartSelector': 'startSelector',
  'http://www.w3.org/ns/oa#hasTarget': 'target',
  'http://www.w3.org/ns/oa#ltrDirection': 'ltr',
  'http://www.w3.org/ns/oa#motivatedBy': 'motivation',
  'http://www.w3.org/ns/oa#rtlDirection': 'rtl',
  'http://www.w3.org/ns/oa#styledBy': 'stylesheet',
*/

describe('not yet emitted', () => {
  it.todo('autoDirection / ltrDirection / rtlDirection (text direction)')
  it.todo('hasScope / scope')
  it.todo('styledBy / stylesheet')
})
