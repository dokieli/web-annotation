import { describe, it, expect } from 'vitest'
import { createAnnotation, tagsToBodyObjects } from '../src/annotation.js'

const minimalTarget = {
  iri: 'https://example.org/article#section-1',
  source: 'https://example.org/article',
  selector: { type: 'TextQuoteSelector', exact: 'web annotations', prefix: 'using ', suffix: ' to build' },
  language: 'en',
}

const minimalBody = { content: 'Great point.' }
const replying = 'oa:replying'

// --- tagsToBodyObjects ---

describe('tagsToBodyObjects', () => {
  it('splits comma-separated tags into body objects', () => {
    const result = tagsToBodyObjects('rdf, linked data, web')
    expect(result).toEqual([
      { purpose: 'tagging', value: 'linked data' },
      { purpose: 'tagging', value: 'rdf' },
      { purpose: 'tagging', value: 'web' },
    ])
  })

  it('supports a classifying purpose', () => {
    const result = tagsToBodyObjects('physics, biology', 'classifying')
    expect(result).toEqual([
      { purpose: 'classifying', value: 'biology' },
      { purpose: 'classifying', value: 'physics' },
    ])
  })

  it('returns empty array for empty / falsy input', () => {
    expect(tagsToBodyObjects('')).toEqual([])
    expect(tagsToBodyObjects(null)).toEqual([])
    expect(tagsToBodyObjects(undefined)).toEqual([])
  })

  it('deduplicates, sorts, and trims tags', () => {
    const result = tagsToBodyObjects('  web , annotations,  rdf , rdf ')
    expect(result.map(t => t.value)).toEqual(['annotations', 'rdf', 'web'])
  })
})

// --- createAnnotation ---

describe('createAnnotation', () => {
  describe('required fields', () => {
    it('throws if motivatedBy is missing', () => {
      expect(() => createAnnotation({ target: minimalTarget, body: minimalBody })).toThrow('motivatedBy is required')
    })

    it('throws if target is missing', () => {
      expect(() => createAnnotation({ motivatedBy: replying, body: minimalBody })).toThrow('target is required')
    })

    it('allows empty content for a body-bearing motivation (bare assessment)', () => {
      const a = createAnnotation({ motivatedBy: 'oa:assessing', target: minimalTarget, body: {} })
      expect(a.body[0].value).toBe('')
    })

    it('does not throw for bookmark with no body.content', () => {
      expect(() => createAnnotation({ motivatedBy: 'oa:bookmarking', target: minimalTarget, body: {} })).not.toThrow()
    })

    it('does not throw for highlighting with no body', () => {
      expect(() => createAnnotation({ motivatedBy: 'oa:highlighting', target: minimalTarget })).not.toThrow()
    })
  })

  describe('motivation + type', () => {
    it('uses the motivatedBy IRI directly', () => {
      const a = createAnnotation({ motivatedBy: 'oa:assessing', target: minimalTarget, body: minimalBody })
      expect(a.motivatedBy).toBe('oa:assessing')
    })

  })

  describe('generated fields', () => {
    it('generates an id and datetime when not provided', () => {
      const a = createAnnotation({ motivatedBy: replying, target: minimalTarget, body: minimalBody })
      expect(typeof a.id).toBe('string')
      expect(() => new Date(a.datetime)).not.toThrow()
    })

    it('uses provided id / datetime / canonical', () => {
      const a = createAnnotation({ motivatedBy: replying, id: 'abc', datetime: '2026-01-01T00:00:00.000Z', target: minimalTarget, body: minimalBody })
      expect(a.id).toBe('abc')
      expect(a.canonical).toBe('urn:uuid:abc')
      expect(a.datetime).toBe('2026-01-01T00:00:00.000Z')
    })
  })

  describe('target', () => {
    it('includes iri, source, language', () => {
      const a = createAnnotation({ motivatedBy: replying, target: minimalTarget, body: minimalBody })
      expect(a.target.iri).toBe(minimalTarget.iri)
      expect(a.target.source).toBe(minimalTarget.source)
      expect(a.target.language).toBe('en')
    })

    it('normalizes a TextQuoteSelector with defaults and assigns an id', () => {
      const a = createAnnotation({ motivatedBy: replying, target: minimalTarget, body: minimalBody })
      expect(a.target.selector).toEqual({
        type: 'TextQuoteSelector',
        id: expect.any(String),
        exact: 'web annotations',
        prefix: 'using ',
        suffix: ' to build',
        language: '',
      })
    })

    it('passes a FragmentSelector through, assigning an id', () => {
      const sel = { type: 'FragmentSelector', value: 'char=0,10', conformsTo: 'https://tools.ietf.org/html/rfc3987' }
      const a = createAnnotation({ motivatedBy: replying, target: { ...minimalTarget, selector: sel }, body: minimalBody })
      expect(a.target.selector).toEqual({ ...sel, id: expect.any(String) })
    })

    it('carries a TimeState through, assigning an id', () => {
      const state = { type: 'TimeState', sourceDate: '2024-01-01T00:00:00Z', cached: 'https://web.archive.org/x' }
      const a = createAnnotation({ motivatedBy: replying, target: { ...minimalTarget, state }, body: minimalBody })
      expect(a.target.state).toEqual({ ...state, id: expect.any(String) })
    })

    it('omits selector when not provided', () => {
      const target = { iri: minimalTarget.iri, source: minimalTarget.source }
      const a = createAnnotation({ motivatedBy: replying, target, body: minimalBody })
      expect(a.target.selector).toBeUndefined()
    })
  })

  describe('body', () => {
    it('includes body content', () => {
      const a = createAnnotation({ motivatedBy: replying, target: minimalTarget, body: { content: 'Hello.' } })
      expect(a.body[0].value).toBe('Hello.')
    })

    it('sets purpose:describing on a bookmark body', () => {
      const a = createAnnotation({ motivatedBy: 'oa:bookmarking', target: minimalTarget, body: { content: 'Saved.' } })
      expect(a.body[0].purpose).toBe('describing')
    })

    it('honors an explicit body.purpose (classifying)', () => {
      const a = createAnnotation({ motivatedBy: 'oa:classifying', target: minimalTarget, body: { content: 'https://example.org/concept/x', purpose: 'classifying' } })
      expect(a.body[0].purpose).toBe('classifying')
    })

    it('appends tag body objects', () => {
      const a = createAnnotation({ motivatedBy: replying, target: minimalTarget, body: { content: 'Hi.', tags: 'rdf, web' } })
      const tags = a.body.filter(b => b.purpose === 'tagging')
      expect(tags.map(t => t.value).sort()).toEqual(['rdf', 'web'])
    })

    it('sets annotation-level language/license/rights from top-level params, not onto the body', () => {
      const license = 'https://creativecommons.org/licenses/by/4.0/'
      const a = createAnnotation({ motivatedBy: replying, target: minimalTarget, language: 'en', license, rights: license, body: { content: 'Hi.' } })
      expect(a.language).toBe('en')
      expect(a.license).toBe(license)
      expect(a.rights).toBe(license)
      expect(a.body[0].language).toBeUndefined()
      expect(a.body[0].license).toBeUndefined()
      expect(a.body[0].rights).toBeUndefined()
    })

    it('sets body-level language/license/rights from body.* only, without leaking up to the annotation', () => {
      const license = 'https://creativecommons.org/licenses/by/4.0/'
      const a = createAnnotation({ motivatedBy: replying, target: minimalTarget, body: { content: 'Hi.', language: 'en', license, rights: license } })
      expect(a.body[0].language).toBe('en')
      expect(a.body[0].license).toBe(license)
      expect(a.body[0].rights).toBe(license)
      expect(a.language).toBeUndefined()
      expect(a.license).toBeUndefined()
      expect(a.rights).toBeUndefined()
    })

    it('keeps annotation-level and body-level values independent when both are supplied', () => {
      const annLicense = 'https://creativecommons.org/licenses/by/4.0/'
      const bodyLicense = 'https://creativecommons.org/publicdomain/zero/1.0/'
      const a = createAnnotation({
        motivatedBy: replying, target: minimalTarget,
        language: 'en', license: annLicense,
        body: { content: 'Bonjour', language: 'fr', license: bodyLicense },
      })
      expect([a.language, a.license]).toEqual(['en', annLicense])
      expect([a.body[0].language, a.body[0].license]).toEqual(['fr', bodyLicense])
    })

    it('produces an empty body for a bodyless highlight', () => {
      const a = createAnnotation({ motivatedBy: 'oa:highlighting', target: minimalTarget })
      expect(a.body).toEqual([])
    })
  })

  describe('creator', () => {
    it('populates creator and omits unset fields', () => {
      const a = createAnnotation({ motivatedBy: replying, target: minimalTarget, body: minimalBody, creator: { name: 'Alice' } })
      expect(a.creator.name).toBe('Alice')
      expect(a.creator.iri).toBeUndefined()
    })
  })

  it('does not stamp a mode field on the annotation', () => {
    expect('mode' in createAnnotation({ motivatedBy: replying, target: minimalTarget, body: minimalBody })).toBe(false)
  })
})
