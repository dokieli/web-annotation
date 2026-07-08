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
import { serializeAnnotationToHTML } from '../src/serialize.js'

// Helpers

function make(overrides = {}) {
  return createAnnotation({
    motivatedBy: 'oa:replying',
    id: 'test-id-1',
    datetime: '2026-04-03T10:00:00.000Z',
    target: {
      iri: 'https://example.org/paper#section-2',
      source: 'https://example.org/paper',
      selector: { type: 'TextQuoteSelector', exact: 'web annotations', prefix: 'using ', suffix: ' here' },
      language: 'en',
    },
    body: { content: 'Great point.', tags: 'rdf, web', language: 'en' },
    creator: { iri: 'https://alice.example/#me', name: 'Alice', url: 'https://alice.example/' },
    ...overrides,
  })
}

function html(annotation, options) {
  return serializeAnnotationToHTML(annotation, options)
}

describe('serializeAnnotationToHTML', () => {
  describe('article element', () => {
    it('wraps output in <article>', () => {
      const result = html(make())
      expect(result).toMatch(/^<article /)
      expect(result).toMatch(/<\/article>$/)
    })

    it('sets id from annotation.id', () => {
      expect(html(make())).toContain('id="test-id-1"')
    })

    it('includes typeof="oa:Annotation"', () => {
      expect(html(make())).toContain('typeof="oa:Annotation"')
    })

    it('includes RDFa prefix attribute for activitystreams-aligned motivations', () => {
      expect(html(make())).toContain('prefix=')
    })

    it('omits RDFa prefix for oa:describing motivation', () => {
      const a = make({ motivatedBy: 'oa:describing' })
      expect(html(a)).not.toContain('prefix=')
    })
  })

  describe('heading', () => {
    it('defaults to h1', () => {
      expect(html(make())).toContain('<h1>')
    })

    it('uses headingLevel option', () => {
      expect(html(make(), { headingLevel: 2 })).toContain('<h2>')
      expect(html(make(), { headingLevel: 3 })).toContain('<h3>')
    })

    it('renders the body Note one level below the heading', () => {
      const a = make({ body: { content: 'Great point.', purpose: 'describing' } })
      expect(html(a, { headingLevel: 3 })).toContain('<h4 ')
    })

    it('includes creator name in heading', () => {
      expect(html(make())).toContain('Alice')
    })

    it('includes motivatedBy label in heading', () => {
      expect(html(make())).toContain('replies')
    })
  })

  describe('creator', () => {
    it('renders creator name', () => {
      expect(html(make())).toContain('Alice')
    })

    it('links creator to their URL', () => {
      expect(html(make())).toContain('href="https://alice.example/"')
    })

    it('includes creator IRI in about attribute', () => {
      expect(html(make())).toContain('https://alice.example/#me')
    })

    it('renders creator avatar when image provided', () => {
      const a = make({ creator: { iri: 'https://alice.example/#me', name: 'Alice', image: 'https://alice.example/avatar.jpg' } })
      expect(html(a)).toContain('<img')
      expect(html(a)).toContain('src="https://alice.example/avatar.jpg"')
    })

    it('omits avatar img when no image', () => {
      expect(html(make())).not.toContain('<img')
    })

    it('renders no authors section when no creator', () => {
      const a = createAnnotation({
        motivatedBy: 'oa:replying',
        id: 'x',
        target: { iri: 'https://example.org/#s', source: 'https://example.org/' },
        body: { content: 'Hi.' },
      })
      expect(html(a)).not.toContain('dcterms:creator')
    })
  })

  describe('datetime', () => {
    it('renders created datetime', () => {
      expect(html(make())).toContain('2026-04-03 10:00:00')
    })

    it('links datetime to the annotation IRI when set', () => {
      const a = { ...make(), iri: 'https://alice.example/annotations/1' }
      const result = html(a)
      expect(result).toContain('href="https://alice.example/annotations/1"')
    })
  })

  describe('language', () => {
    it('renders language section when body has language', () => {
      expect(html(make())).toContain('dcterms:language')
    })

    it('uses the language code as the value, not a display name', () => {
      const a = createAnnotation({
        motivatedBy: 'oa:replying', id: 'x',
        target: { iri: 'https://example.org/#s', source: 'https://example.org/' },
        body: { content: 'Hi.', language: 'en-GB' },
        language: 'en-GB',
      })
      const out = html(a)
      expect(out).toContain('property="dcterms:language" xml:lang="" datatype="xsd:string">en-GB</span>')
      expect(out).not.toContain('British English')
    })

    it('omits language section when no language set', () => {
      const a = createAnnotation({
        motivatedBy: 'oa:replying',
        id: 'x',
        target: { iri: 'https://example.org/#s', source: 'https://example.org/' },
        body: { content: 'Hi.' },
      })
      expect(html(a)).not.toContain('dcterms:language')
    })

    it('emits code in @content and resolved display name as the text node', () => {
      const a = createAnnotation({
        motivatedBy: 'oa:replying', id: 'x',
        target: { iri: 'https://example.org/#s', source: 'https://example.org/', language: 'en-GB' },
        body: { content: 'Hi.', language: 'en-GB' },
        language: 'en-GB',
      })
      const out = html(a, { resolveLanguageName: () => 'English' })
      expect(out).toContain('content="en-GB" lang="" property="dcterms:language" xml:lang="" datatype="xsd:string">English</span>')
      expect(out).not.toContain('xml:lang="" datatype="xsd:string">en-GB</span>')
    })
  })

  describe('license', () => {
    it('renders license link with raw IRI when no licenses map provided', () => {
      const license = 'https://creativecommons.org/licenses/by/4.0/'
      const a = make({ body: { content: 'Hi.', license } })
      expect(html(a)).toContain(`href="${license}"`)
      expect(html(a)).toContain(license)
    })

    it('renders license display name from licenses map', () => {
      const license = 'https://creativecommons.org/licenses/by/4.0/'
      const a = make({ body: { content: 'Hi.', license } })
      const result = html(a, { licenses: { [license]: { name: 'CC BY 4.0' } } })
      expect(result).toContain('CC BY 4.0')
    })
  })

  describe('target', () => {
    it('renders target IRI as a link', () => {
      expect(html(make())).toContain('href="https://example.org/paper#section-2"')
    })

    it('renders TextQuoteSelector exact text in <mark>', () => {
      expect(html(make())).toContain('<mark')
      expect(html(make())).toContain('web annotations')
    })

    it('renders prefix and suffix around exact text', () => {
      const result = html(make())
      expect(result).toContain('using ')
      expect(result).toContain(' here')
    })

    it('includes oa:hasSource when target.source is present', () => {
      expect(html(make())).toContain('oa:hasSource')
      expect(html(make())).toContain('https://example.org/paper')
    })

    it('renders target language', () => {
      expect(html(make())).toContain('en')
    })

    it('omits renderedVia when no rendering tool is supplied', () => {
      expect(html(make())).not.toContain('oa:renderedVia')
    })

    it('renders the supplied renderedVia tool (iri + display name)', () => {
      const out = html(make({ target: {
        iri: 'https://example.org/paper#section-2',
        source: 'https://example.org/paper',
        renderedVia: { iri: 'https://dokie.li/#i', name: 'dokieli' },
      } }))
      expect(out).toContain('href="https://dokie.li/#i" rel="oa:renderedVia">dokieli</a>')
    })
  })

  describe('body', () => {
    it('renders body content', () => {
      expect(html(make())).toContain('Great point.')
    })

    it('renders tags', () => {
      const result = html(make())
      expect(result).toContain('oa:tagging')
      expect(result).toContain('rdf')
      expect(result).toContain('web')
    })

    it('renders bookmark body with describing purpose', () => {
      const a = createAnnotation({
        motivatedBy: 'oa:bookmarking',
        id: 'bm1',
        target: { iri: 'https://example.org/#s', source: 'https://example.org/' },
        body: { content: 'Saved for later.' },
        creator: { name: 'Alice' },
      })
      expect(html(a)).toContain('oa:describing')
    })
  })

  describe('canonical', () => {
    it('renders canonical IRI', () => {
      expect(html(make())).toContain('urn:uuid:test-id-1')
    })
  })

  describe('inbox', () => {
    it('renders inbox when present', () => {
      const a = make()
      a.inbox = 'https://alice.example/inbox/'
      const result = html(a)
      expect(result).toContain('ldp:inbox')
      expect(result).toContain('https://alice.example/inbox/')
    })

    it('omits inbox when not set', () => {
      expect(html(make())).not.toContain('ldp:inbox')
    })
  })

  describe('target relation', () => {
    it('defaults the target rel to oa:hasTarget', () => {
      expect(html(make())).toContain('rel="oa:hasTarget"')
    })

    it('honors a caller-supplied target.rel (e.g. as:inReplyTo)', () => {
      const a = make({ target: { iri: 'https://example.org/note', source: 'https://example.org/note', rel: 'as:inReplyTo' } })
      expect(html(a)).toContain('rel="as:inReplyTo"')
    })
  })

  describe('labels', () => {
    it('defaults section labels to English', () => {
      const result = html(make())
      expect(result).toContain('<dt>Authors</dt>')
      expect(result).toContain('<dt>Created</dt>')
      expect(result).toContain('<dt>Canonical</dt>')
    })

    it('overrides section labels from options.labels, leaving others at default', () => {
      const result = html(make(), { labels: { authors: 'Auteurs', created: 'Créé' } })
      expect(result).toContain('<dt>Auteurs</dt>')
      expect(result).toContain('<dt>Créé</dt>')
      expect(result).toContain('<dt>Canonical</dt>')
    })

    it('overrides selector labels', () => {
      const a = make({
        target: {
          iri: 'https://example.org/#s', source: 'https://example.org/',
          selector: { type: 'RangeSelector',
            startSelector: { type: 'XPathSelector', value: '/p[1]' },
            endSelector: { type: 'XPathSelector', value: '/p[2]' } },
        },
      })
      const result = html(a, { labels: { startSelector: 'Début', endSelector: 'Fin' } })
      expect(result).toContain('<dt>Début</dt>')
      expect(result).toContain('<dt>Fin</dt>')
    })

    it('overrides motivation labels from options.motivationLabels', () => {
      const result = html(make(), { motivationLabels: { 'oa:replying': { label: 'répond', targetLabel: 'En réponse à' } } })
      expect(result).toContain('>répond</span>')
      expect(result).toContain('>En réponse à</a>')
    })
  })

  describe('about (RDFa subject)', () => {
    it('defaults to a local fragment when no IRI is set', () => {
      expect(html(make())).toContain('<article about="#test-id-1"')
    })

    it('defaults to the annotation IRI when set', () => {
      const a = { ...make(), iri: 'https://alice.example/annotations/1' }
      expect(html(a)).toContain('<article about="https://alice.example/annotations/1"')
    })

    it('uses the about option when provided', () => {
      expect(html(make(), { about: '' })).toContain('<article about=""')
      const a = { ...make(), iri: 'https://alice.example/annotations/1' }
      expect(html(a, { about: '#test-id-1' })).toContain('<article about="#test-id-1"')
    })
  })

  describe('resolveImage / resolveName callbacks', () => {
    it('uses resolveImage return value over creator.image', () => {
      const result = html(make({ creator: { iri: 'https://alice.example/#me', name: 'Alice', image: 'https://alice.example/avatar.jpg' } }), {
        resolveImage: c => `https://proxy.example/?u=${encodeURIComponent(c.image ?? '')}`,
      })
      expect(result).toContain('https://proxy.example/?u=https%3A%2F%2Falice.example%2Favatar.jpg')
    })

    it('falls back to creator.image when resolveImage returns undefined', () => {
      const result = html(make({ creator: { iri: 'https://alice.example/#me', name: 'Alice', image: 'https://alice.example/avatar.jpg' } }), {
        resolveImage: () => undefined,
      })
      expect(result).toContain('src="https://alice.example/avatar.jpg"')
    })

    it('renders no avatar when both resolveImage and creator.image are absent', () => {
      const result = html(make({ creator: { iri: 'https://alice.example/#me', name: 'Alice' } }), {
        resolveImage: () => undefined,
      })
      expect(result).not.toContain('<img')
    })

    it('uses resolveName return value over creator.name', () => {
      const result = html(make({ creator: { iri: 'https://alice.example/#me', name: 'Alice' } }), {
        resolveName: c => c.iri === 'https://alice.example/#me' ? 'Alice (You)' : c.name,
      })
      expect(result).toContain('Alice (You)')
    })

    it('falls back to creator.name when resolveName returns undefined', () => {
      const result = html(make({ creator: { iri: 'https://alice.example/#me', name: 'Alice' } }), {
        resolveName: () => undefined,
      })
      expect(result).toContain('>Alice<')
    })
  })

  describe('motivation variants', () => {
    it.each([
      ['oa:questioning', 'questions'],
      ['oa:bookmarking', 'bookmarks'],
    ])('motivation %s renders correct label', (motivatedBy, label) => {
      const a = createAnnotation({
        motivatedBy,
        id: 'x',
        target: { iri: 'https://example.org/#s', source: 'https://example.org/' },
        body: motivatedBy === 'oa:bookmarking' ? {} : { content: 'text' },
        creator: { name: 'Alice' },
      })
      expect(html(a)).toContain(label)
    })
  })

  describe('typed selectors', () => {
    function withSelector(selector) {
      return html(make({ target: { iri: 'https://example.org/p#s', source: 'https://example.org/p', selector } }))
    }

    it('renders a bare TextQuoteSelector faithfully (no FragmentSelector wrapper)', () => {
      const result = withSelector({ type: 'TextQuoteSelector', exact: 'abc', prefix: 'x', suffix: 'y' })
      expect(result).not.toContain('typeof="oa:FragmentSelector"')
      expect(result).not.toContain('rel="oa:refinedBy"')
      expect(result).toContain('typeof="oa:TextQuoteSelector"')
      expect(result).toMatch(/resource="#[0-9a-f-]+" typeof="oa:TextQuoteSelector"/)
      // No language available: the mark carries no lang (no empty langString).
      expect(result).toContain('<mark property="oa:exact">abc</mark>')
    })

    it('puts the selector language on the dd, not on the marks', () => {
      const result = withSelector({ type: 'TextQuoteSelector', exact: 'abc', prefix: 'p', suffix: 's', language: 'de' })
      expect(result).toContain('<dd lang="de" xml:lang="de">')
      expect(result).toContain('<mark property="oa:exact">abc</mark>')
      expect(result).not.toContain('<mark lang=')
    })

    it('renders refinedBy on a TextQuoteSelector (refinement wrapped in a dd)', () => {
      const result = withSelector({
        type: 'TextQuoteSelector', exact: 'abc',
        refinedBy: { type: 'TextPositionSelector', start: 12, end: 20 },
      })
      expect(result).toContain('typeof="oa:TextQuoteSelector"')
      expect(result).toContain('<dd><dl rel="oa:refinedBy"')
      expect(result).toContain('typeof="oa:TextPositionSelector"')
    })

    it('renders refinedBy on a TextPositionSelector', () => {
      const result = withSelector({
        type: 'TextPositionSelector', start: 0, end: 5,
        refinedBy: { type: 'TextQuoteSelector', exact: 'abc' },
      })
      expect(result).toContain('typeof="oa:TextPositionSelector"')
      expect(result).toContain('<dd><dl rel="oa:refinedBy"')
      expect(result).toContain('typeof="oa:TextQuoteSelector"')
    })

    it('renders an explicit FragmentSelector', () => {
      const result = withSelector({ type: 'FragmentSelector', value: 'xywh=10,20,30,40' })
      expect(result).toContain('typeof="oa:FragmentSelector"')
      expect(result).toContain('content="xywh=10,20,30,40"')
    })

    it('renders an XPathSelector', () => {
      const result = withSelector({ type: 'XPathSelector', value: '/html/body/p[2]' })
      expect(result).toContain('typeof="oa:XPathSelector"')
      expect(result).toContain('/html/body/p[2]')
    })

    it('renders a TextPositionSelector', () => {
      const result = withSelector({ type: 'TextPositionSelector', start: 12, end: 20 })
      expect(result).toContain('typeof="oa:TextPositionSelector"')
      expect(result).toContain('property="oa:start"')
      expect(result).toContain('>12<')
      expect(result).toContain('>20<')
    })

    it('renders a RangeSelector with start and end sub-selectors', () => {
      const result = withSelector({
        type: 'RangeSelector',
        startSelector: { type: 'XPathSelector', value: '/p[1]' },
        endSelector: { type: 'XPathSelector', value: '/p[2]' },
      })
      expect(result).toContain('typeof="oa:RangeSelector"')
      expect(result).toContain('rel="oa:hasStartSelector"')
      expect(result).toContain('rel="oa:hasEndSelector"')
    })
  })

  describe('TimeState', () => {
    it('renders an oa:hasState / oa:TimeState block', () => {
      const a = make({
        target: {
          iri: 'https://example.org/p#s',
          source: 'https://example.org/p',
          state: { type: 'TimeState', sourceDate: '2024-01-01T00:00:00Z', cached: 'https://web.archive.org/x' },
        },
      })
      const result = html(a)
      expect(result).toContain('rel="oa:hasState"')
      expect(result).toContain('typeof="oa:TimeState"')
      expect(result).toContain('property="oa:sourceDate"')
      expect(result).toContain('rel="oa:cachedSource"')
      expect(result).toContain('https://web.archive.org/x')
    })
  })

  describe('classifying body', () => {
    it('renders a classifications list with oa:classifying', () => {
      const a = createAnnotation({
        motivatedBy: 'oa:classifying',
        id: 'c1',
        target: { iri: 'https://example.org/#s', source: 'https://example.org/' },
        body: { content: 'https://example.org/concept/physics', purpose: 'classifying' },
        creator: { name: 'Alice' },
      })
      const result = html(a)
      expect(result).toContain('class="classifications"')
      expect(result).toContain('resource="oa:classifying"')
      expect(result).toContain('https://example.org/concept/physics')
    })
  })

  describe('purpose forms', () => {
    const withPurpose = (purpose, content = 'x') => createAnnotation({
      motivatedBy: 'oa:replying', id: 'p1',
      target: { iri: 'https://example.org/#s', source: 'https://example.org/' },
      body: { content, purpose },
      creator: { name: 'Alice' },
    })

    it('recognizes an oa: prefixed well-known purpose (oa:tagging -> tags list)', () => {
      const result = html(withPurpose('oa:tagging', 'topic'))
      expect(result).toContain('class="tags"')
      expect(result).toContain('resource="oa:tagging"')
    })

    it('recognizes a full-IRI well-known purpose (describing -> Note section)', () => {
      expect(html(withPurpose('http://www.w3.org/ns/oa#describing', 'A note.'))).toContain('resource="oa:describing"')
    })

    it('emits oa:hasPurpose verbatim for a custom purpose IRI', () => {
      const result = html(withPurpose('http://example.org/vocab#reviewing', 'Reviewed.'))
      expect(result).toContain('rel="oa:hasPurpose" resource="http://example.org/vocab#reviewing"')
    })
  })
})
