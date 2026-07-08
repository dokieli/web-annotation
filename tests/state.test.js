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
import { serializeAnnotationToJSONLD } from '../src/jsonld.js'
import { serializeAnnotation } from '../src/serialize.js'
import { parseStoredAnnotation } from '../src/parse.js'
import { getTimeState, getHttpRequestState, statesToSelectors } from '../src/build-selectors.js'

const quote = { type: 'TextQuoteSelector', exact: 'web annotations', prefix: 'using ', suffix: ' here' }
const position = { type: 'TextPositionSelector', start: 6, end: 17 }

function annotationWithState() {
  const http = getHttpRequestState({ value: 'Accept: text/html', refinedBy: [quote, position] })
  const time = getTimeState({ sourceDate: '2026-04-03T10:00:00.000Z', refinedBy: http })
  return createAnnotation({
    motivatedBy: 'oa:replying',
    id: 'a1',
    datetime: '2026-04-03T10:00:00.000Z',
    target: {
      iri: 'https://example.org/paper#s2',
      source: 'https://example.org/paper',
      selector: quote,
      state: time,
    },
    body: { content: 'x' },
  })
}

describe('HttpRequestState round-trip', () => {
  it('serializes the TimeState -> HttpRequestState -> [selectors] chain to JSON-LD', () => {
    const ld = serializeAnnotationToJSONLD(annotationWithState())
    expect(ld.target.state).toMatchObject({
      type: 'TimeState',
      sourceDate: '2026-04-03T10:00:00.000Z',
      refinedBy: { type: 'HttpRequestState', value: 'Accept: text/html' },
    })
    const sels = ld.target.state.refinedBy.refinedBy
    expect(sels).toHaveLength(2)
    expect(sels[0]).toMatchObject({ type: 'TextQuoteSelector', exact: 'web annotations' })
    expect(sels[1]).toMatchObject({ type: 'TextPositionSelector', start: 6, end: 17 })
  })

  it('parses the chain back from JSON-LD', () => {
    const a = parseStoredAnnotation(serializeAnnotationToJSONLD(annotationWithState()))
    expect(a).not.toBeNull()
    const state = a.target.state
    expect(state.type).toBe('TimeState')
    expect(state.sourceDate).toBe('2026-04-03T10:00:00.000Z')
    expect(state.refinedBy.type).toBe('HttpRequestState')
    expect(state.refinedBy.value).toBe('Accept: text/html')
    expect(state.refinedBy.refinedBy.map(s => s.type)).toEqual([
      'TextQuoteSelector',
      'TextPositionSelector',
    ])
  })

  it('renders HttpRequestState to HTML+RDFa', () => {
    const ann = annotationWithState()
    const html = serializeAnnotation(ann, { format: 'html' })
    expect(html).toContain('typeof="oa:TimeState"')
    expect(html).toContain('typeof="oa:HttpRequestState"')
    expect(html).toContain('Accept: text/html')
    expect(html).toContain(`resource="#${ann.target.state.id}"`)            // top-level TimeState
    expect(html).toContain(`resource="#${ann.target.state.refinedBy.id}"`)  // nested HttpRequestState
  })

  it('round-trips multiple header lines as an array', () => {
    const http = getHttpRequestState({ value: ['Accept: text/html', 'Accept-Language: en'] })
    const ann = createAnnotation({
      motivatedBy: 'oa:replying',
      id: 'a2',
      target: { iri: 'x', source: 'x', state: http },
      body: { content: 'x' },
    })
    const back = parseStoredAnnotation(serializeAnnotationToJSONLD(ann))
    expect(back.target.state.value).toEqual(['Accept: text/html', 'Accept-Language: en'])
  })

  it('statesToSelectors extracts nested quote/position', () => {
    const sels = statesToSelectors(annotationWithState().target.state)
    expect(sels.map(s => s.type)).toEqual(['TextQuoteSelector', 'TextPositionSelector'])
  })
})
