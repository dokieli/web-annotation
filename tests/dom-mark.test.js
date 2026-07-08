import { describe, it, expect, beforeEach } from 'vitest'
import { applyMark, applyMarkFromSelector, restoreMarks, applyMarksFromTextQuote } from '../src/dom-mark.js'

const URL = 'https://alice.example/annotations/1'

function makeContainer(html) {
  const div = document.createElement('div')
  div.innerHTML = html
  document.body.appendChild(div)
  return div
}

function rangeOver(textNode, text) {
  const start = textNode.textContent.indexOf(text)
  const range = document.createRange()
  range.setStart(textNode, start)
  range.setEnd(textNode, start + text.length)
  return range
}

function tq(exact, prefix = '', suffix = '') {
  return { type: 'TextQuoteSelector', exact, prefix, suffix }
}

beforeEach(() => {
  document.body.innerHTML = ''
  window.getSelection().removeAllRanges()
})

describe('applyMark', () => {
  it('wraps a range in span > mark and ties the mark to the annotation', () => {
    const c = makeContainer('<p>The quick brown fox</p>')
    const textNode = c.querySelector('p').firstChild
    const span = applyMark(rangeOver(textNode, 'brown'), { annotationUrl: URL })

    expect(span.tagName).toBe('SPAN')
    const mark = span.querySelector('mark')
    expect(mark.textContent).toBe('brown')
    expect(mark.getAttribute('property')).toBe('rdf:value')
    expect(mark.id).toBeTruthy()
    // The span is the dcterms:hasPart fragment resource; the default reference links to the annotation.
    expect(span.getAttribute('rel')).toBe('dcterms:hasPart')
    expect(span.getAttribute('resource')).toBe('#' + mark.id)
    expect(span.querySelector('a').getAttribute('href')).toBe(URL)
  })

  it('applies className to the span', () => {
    const c = makeContainer('<p>alpha beta</p>')
    const span = applyMark(rangeOver(c.querySelector('p').firstChild, 'beta'), {
      annotationUrl: URL, className: 'ref',
    })
    expect(span.classList.contains('ref')).toBe(true)
  })

  it('appends the caller reference after the mark', () => {
    const c = makeContainer('<p>alpha beta</p>')
    const span = applyMark(rangeOver(c.querySelector('p').firstChild, 'beta'), {
      annotationUrl: URL,
      reference: '<sup class="ref-x"><a href="#whatever">x</a></sup>',
    })
    expect(span.querySelector('sup.ref-x a').getAttribute('href')).toBe('#whatever')
  })

  it('splits across block nodes into one mark per node, unique ids, reference on the last only', () => {
    const c = makeContainer('<div><p id="a">first para</p><p id="b">second para</p></div>')
    const t1 = c.querySelector('#a').firstChild
    const t2 = c.querySelector('#b').firstChild
    const range = document.createRange()
    range.setStart(t1, t1.textContent.indexOf('para'))
    range.setEnd(t2, t2.textContent.indexOf(' para'))

    applyMark(range, { annotationUrl: URL, className: 'ref', reference: '<sup>💬</sup>' })

    const marks = c.querySelectorAll('mark')
    expect(marks.length).toBe(2)
    expect(c.querySelector('#a span').getAttribute('rel')).toBe('dcterms:hasPart')
    expect(marks[0].id).not.toBe(marks[1].id)
    // The reference is appended once, in the last segment.
    expect(c.querySelectorAll('sup').length).toBe(1)
    expect(c.querySelector('#b sup')).not.toBeNull()
  })

  it('wraps inter-node whitespace as its own segment (part of the highlight)', () => {
    const c = makeContainer('<div><p id="a">one</p>\n\n<p id="b">two</p></div>')
    const t1 = c.querySelector('#a').firstChild
    const t2 = c.querySelector('#b').firstChild
    const range = document.createRange()
    range.setStart(t1, 0)
    range.setEnd(t2, 3)
    applyMark(range, { annotationUrl: URL })
    // "one", the whitespace, and "two" each get their own span > mark.
    expect(c.querySelectorAll('mark').length).toBe(3)
    expect([...c.querySelectorAll('mark')].some(m => m.textContent.trim() === '')).toBe(true)
  })
})

describe('restoreMarks', () => {
  it('marks each annotation whose TextQuoteSelector resolves, tying it to the IRI', () => {
    const c = makeContainer('<p>The quick brown fox jumps over the lazy dog</p>')
    restoreMarks(c, [
      { iri: URL, motivatedBy: 'oa:replying', target: { selector: tq('brown fox', 'quick ', ' jumps') } },
    ])
    const mark = c.querySelector('mark')
    expect(mark).not.toBeNull()
    expect(mark.textContent).toBe('brown fox')
    expect(mark.closest('span').getAttribute('resource')).toBe('#' + mark.id)
    expect(c.querySelector('a').getAttribute('href')).toBe(URL)
  })

  it('skips annotations without a TextQuoteSelector', () => {
    const c = makeContainer('<p>hello world</p>')
    restoreMarks(c, [
      { iri: URL, motivatedBy: 'oa:replying', target: { selector: { type: 'XPathSelector', value: '/p' } } },
    ])
    expect(c.querySelector('mark')).toBeNull()
  })

  it('skips annotations without a resolvable URL', () => {
    const c = makeContainer('<p>brown fox</p>')
    restoreMarks(c, [
      { motivatedBy: 'oa:replying', target: { selector: tq('brown fox') } },
    ])
    expect(c.querySelector('mark')).toBeNull()
  })

  it('skips a match inside excludeMatchesIn', () => {
    const c = makeContainer('<div id="panel"><p>brown fox</p></div>')
    restoreMarks(c, [
      { iri: URL, motivatedBy: 'oa:replying', target: { selector: tq('brown fox') } },
    ], { excludeMatchesIn: '#panel' })
    expect(c.querySelector('mark')).toBeNull()
  })

  it('passes className and resolves the reference per annotation', () => {
    const c = makeContainer('<div id="panel"><p>brown fox</p></div>')
    restoreMarks(c, [
      { iri: URL, motivatedBy: 'oa:replying', target: { selector: tq('brown fox') } },
    ], {
      className: 'ref',
      getReference: () => '<sup class="ref-annotation">💬</sup>',
    })
    const mark = c.querySelector('#panel mark')
    expect(mark.closest('span').classList.contains('ref')).toBe(true)
    expect(mark.closest('span').getAttribute('rel')).toBe('dcterms:hasPart')
    expect(c.querySelector('#panel sup.ref-annotation')).not.toBeNull()
  })
})

describe('applyMarkFromSelector', () => {
  it('marks a RangeSelector spanning blocks, one mark per node, tied to the annotation', () => {
    const c = makeContainer('<article><p>first paragraph</p><p>second paragraph</p><p>third paragraph</p></article>')
    const selector = {
      type: 'RangeSelector',
      startSelector: { type: 'XPathSelector', value: '/html[1]/body[1]/div[1]/article[1]/p[1]' },
      endSelector: { type: 'XPathSelector', value: '/html[1]/body[1]/div[1]/article[1]/p[2]' },
    }
    applyMarkFromSelector(c.querySelector('article'), selector, { annotationUrl: URL, className: 'ref', reference: '<sup>S</sup>' })
    const marks = c.querySelectorAll('mark')
    expect(marks.length).toBe(2)
    expect([...marks].every(m => m.closest('span').getAttribute('rel') === 'dcterms:hasPart')).toBe(true)
    expect(c.querySelectorAll('sup').length).toBe(1)
    // Third paragraph is outside the range and untouched.
    expect(c.querySelectorAll('p')[2].querySelector('mark')).toBeNull()
  })

  it('honors an XPathSelector refinedBy a TextQuoteSelector to narrow the range', () => {
    const c = makeContainer('<article><p>the quick brown fox</p></article>')
    const selector = {
      type: 'XPathSelector',
      value: '/html[1]/body[1]/div[1]/article[1]/p[1]',
      refinedBy: { type: 'TextQuoteSelector', exact: 'quick brown', prefix: 'the ', suffix: ' fox' },
    }
    applyMarkFromSelector(c.querySelector('article'), selector, { annotationUrl: URL })
    const mark = c.querySelector('mark')
    expect(mark.textContent).toBe('quick brown')
  })

  it('marks a single XPathSelector element', () => {
    const c = makeContainer('<article><p>alpha</p><p>beta</p></article>')
    applyMarkFromSelector(c.querySelector('article'), { type: 'XPathSelector', value: '/html[1]/body[1]/div[1]/article[1]/p[2]' }, { annotationUrl: URL })
    expect(c.querySelectorAll('mark').length).toBe(1)
    expect(c.querySelector('mark').textContent).toBe('beta')
  })

  it('returns null for an unresolvable selector', () => {
    const c = makeContainer('<article><p>x</p></article>')
    expect(applyMarkFromSelector(c.querySelector('article'), { type: 'XPathSelector', value: '/nope[9]' }, { annotationUrl: URL })).toBeNull()
  })
})

describe('applyMarksFromTextQuote', () => {
  it('marks every occurrence of the phrase', () => {
    const c = makeContainer('<p>red fish, red fish, blue fish</p>')
    applyMarksFromTextQuote(c, tq('red fish'), { annotationUrl: URL })
    expect(c.querySelectorAll('mark').length).toBe(2)
    expect(c.querySelector('mark').closest('span').getAttribute('rel')).toBe('dcterms:hasPart')
  })

  it('returns null when nothing matches', () => {
    const c = makeContainer('<p>nothing here</p>')
    expect(applyMarksFromTextQuote(c, tq('absent'), { annotationUrl: URL })).toBeNull()
  })

  it('marks a phrase split by a prior annotation decoration via ignoreSelector', () => {
    // Without exclusion the injected <sup> breaks contiguity of 'universal access'.
    const c = makeContainer('<p>universal <sup class="ref-x">1</sup>access to information</p>')

    expect(applyMarksFromTextQuote(c, tq('universal access'), { annotationUrl: URL })).toBeNull()

    const span = applyMarksFromTextQuote(c, tq('universal access'), { annotationUrl: URL, ignoreSelector: 'sup' })
    expect(span).not.toBeNull()
    // The mark wraps text on each side of the decoration; the <sup> stays untouched.
    const marked = [...c.querySelectorAll('mark')].map(m => m.textContent).join('')
    expect(marked).toBe('universal access')
    expect(c.querySelector('sup.ref-x')).not.toBeNull()
    expect(c.querySelector('sup.ref-x mark')).toBeNull()
    expect([...c.querySelectorAll('mark')].every(m => m.closest('span').getAttribute('rel') === 'dcterms:hasPart')).toBe(true)
  })
})

describe('ignoreSelector through applyMarkFromSelector', () => {
  it('resolves a TextPositionSelector against decoration-free offsets', () => {
    // Positions 6..11 ('world') only line up once the injected <sup> is excluded from the offset count.
    const c = makeContainer('<p>Hello<sup>1</sup> world</p>')
    const selector = { type: 'TextPositionSelector', start: 6, end: 11 }

    applyMarkFromSelector(c, selector, { annotationUrl: URL, ignoreSelector: 'sup' })
    expect(c.querySelector('mark').textContent).toBe('world')
  })
})
