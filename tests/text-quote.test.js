import { describe, it, expect, beforeEach } from 'vitest'
import {
  selectionToTextQuote,
  setSelectionFromTextQuote,
  setSelectionByOffset,
  findTextQuoteOffsets,
  getTextContent,
  offsetInContainer,
} from '../src/text-quote.js'
import { getTextQuoteSelector } from '../src/build-selectors.js'

function makeContainer(html) {
  const div = document.createElement('div')
  div.innerHTML = html
  document.body.appendChild(div)
  return div
}

function selectText(container, text) {
  const range = document.createRange()
  const textNode = Array.from(container.querySelectorAll('*'))
    .flatMap(el => Array.from(el.childNodes))
    .concat(Array.from(container.childNodes))
    .find(n => n.nodeType === Node.TEXT_NODE && n.textContent.includes(text))

  if (!textNode) throw new Error(`Text "${text}" not found in container`)

  const start = textNode.textContent.indexOf(text)
  range.setStart(textNode, start)
  range.setEnd(textNode, start + text.length)

  const selection = window.getSelection()
  selection.removeAllRanges()
  selection.addRange(range)
  return selection
}

beforeEach(() => {
  document.body.innerHTML = ''
  window.getSelection().removeAllRanges()
})

describe('selectionToTextQuote', () => {
  it('returns exact, prefix, and suffix for a mid-sentence selection', () => {
    const container = makeContainer('<p>The quick brown fox jumps over the lazy dog</p>')
    const selection = selectText(container, 'brown fox')

    const result = selectionToTextQuote(container, selection)

    expect(result.type).toBe('TextQuoteSelector')
    expect(result.exact).toBe('brown fox')
    expect(result.prefix).toBe('The quick ')
    expect(result.suffix).toBe(' jumps over the lazy dog')
  })

  it('truncates prefix and suffix to contextLength (default 32)', () => {
    const container = makeContainer('<p>aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa TARGET bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb</p>')
    const selection = selectText(container, 'TARGET')

    const result = selectionToTextQuote(container, selection)

    expect(result.prefix.length).toBeLessThanOrEqual(32)
    expect(result.suffix.length).toBeLessThanOrEqual(32)
  })

  it('respects a custom contextLength option', () => {
    const container = makeContainer('<p>Hello world foo bar</p>')
    const selection = selectText(container, 'foo')

    const result = selectionToTextQuote(container, selection, { contextLength: 5 })

    expect(result.prefix.length).toBeLessThanOrEqual(5)
    expect(result.suffix.length).toBeLessThanOrEqual(5)
  })

  it('returns empty prefix when selection is at the start', () => {
    const container = makeContainer('<p>Hello world</p>')
    const selection = selectText(container, 'Hello')

    const result = selectionToTextQuote(container, selection)

    expect(result.prefix).toBe('')
    expect(result.exact).toBe('Hello')
  })

  it('returns empty suffix when selection is at the end', () => {
    const container = makeContainer('<p>Hello world</p>')
    const selection = selectText(container, 'world')

    const result = selectionToTextQuote(container, selection)

    expect(result.suffix).toBe('')
    expect(result.exact).toBe('world')
  })

  it('returns null when there is no selection', () => {
    const container = makeContainer('<p>Hello world</p>')
    const selection = window.getSelection()
    selection.removeAllRanges()

    expect(selectionToTextQuote(container, selection)).toBeNull()
  })
})

describe('setSelectionFromTextQuote', () => {
  it('restores a selection by exact + prefix + suffix', () => {
    const container = makeContainer('<p>The quick brown fox jumps over the lazy dog</p>')

    const found = setSelectionFromTextQuote(container, {
      exact: 'brown fox',
      prefix: 'The quick ',
      suffix: ' jumps'
    })

    expect(found).toBe(true)
    expect(window.getSelection().toString()).toBe('brown fox')
  })

  it('falls back to exact-only match when prefix+suffix search fails', () => {
    const container = makeContainer('<p>Hello world</p>')

    const found = setSelectionFromTextQuote(container, {
      exact: 'world',
      prefix: 'nonexistent prefix ',
      suffix: ''
    })

    expect(found).toBe(true)
    expect(window.getSelection().toString()).toBe('world')
  })

  it('returns false when exact text is not present', () => {
    const container = makeContainer('<p>Hello world</p>')

    const found = setSelectionFromTextQuote(container, {
      exact: 'missing text',
      prefix: '',
      suffix: ''
    })

    expect(found).toBe(false)
  })

  it('round-trips with selectionToTextQuote', () => {
    const container = makeContainer('<p>Annotations are useful for collaborative reading.</p>')
    const selection = selectText(container, 'useful')
    const selector = selectionToTextQuote(container, selection)

    window.getSelection().removeAllRanges()

    const found = setSelectionFromTextQuote(container, selector)
    expect(found).toBe(true)
    expect(window.getSelection().toString()).toBe('useful')
  })
})

describe('setSelectionByOffset', () => {
  it('counts all text including inline elements (sup-agnostic)', () => {
    const container = makeContainer('<p>Hello<sup>X</sup> world</p>')
    // 'HelloX world', 'world' is offsets 7..12
    setSelectionByOffset(7, 12, container)
    expect(window.getSelection().toString()).toBe('world')
  })

  it('skips ignoreSelector subtrees so offsets count only document text', () => {
    const container = makeContainer('<p>Hello<sup>X</sup> world</p>')
    // With <sup> excluded, text is 'Hello world', 'world' is at 6..11.
    setSelectionByOffset(6, 11, container, { ignoreSelector: 'sup' })
    expect(window.getSelection().toString()).toBe('world')
  })
})

describe('ignoreSelector text basis', () => {
  it('getTextContent omits matching subtrees', () => {
    const container = makeContainer('<p>Hello<sup>X</sup> world</p>')
    expect(getTextContent(container)).toBe('HelloX world')
    expect(getTextContent(container, 'sup')).toBe('Hello world')
  })

  it('offsetInContainer counts the same text getTextContent does', () => {
    const container = makeContainer('<p>Hello<sup>X</sup> world</p>')
    const worldNode = container.querySelectorAll('p')[0].lastChild // ' world'
    // ' world' starts after 'Hello' (5 chars) once <sup> is excluded.
    expect(offsetInContainer(container, worldNode, 1, 'sup')).toBe(6)
  })

  it('findTextQuoteOffsets matches a phrase interrupted by an ignored decoration', () => {
    // Injected <sup> marker breaks phrase contiguity in textContent unless excluded.
    const container = makeContainer('<p>universal <sup>1</sup>access to information</p>')
    const sel = { exact: 'universal access', prefix: '', suffix: '' }

    expect(findTextQuoteOffsets(container, sel)).toHaveLength(0)
    expect(findTextQuoteOffsets(container, sel, { ignoreSelector: 'sup' })).toEqual([{ start: 0, end: 16 }])
  })

  it('build -> resolve round-trips with a decoration in the context window', () => {
    // Selector built over clean DOM; excluding the later-injected decoration on resolve restores the selection.
    const container = makeContainer('<p>researcher autonomy in a social system</p>')
    const selection = selectText(container, 'a social system')
    const selector = getTextQuoteSelector(selection.getRangeAt(0), container, { ignoreSelector: 'sup' })

    // Inject a marker inside the prefix region.
    container.querySelector('p').insertAdjacentHTML('afterbegin', '<sup>1</sup>')
    window.getSelection().removeAllRanges()

    const found = setSelectionFromTextQuote(container, selector, { ignoreSelector: 'sup' })
    expect(found).toBe(true)
    expect(window.getSelection().toString()).toBe('a social system')
  })
})
