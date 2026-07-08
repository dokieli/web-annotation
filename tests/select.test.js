import { describe, it, expect } from 'vitest'
import { selectionToSelectors } from '../src/select.js'

function makeContainer(html) {
  const div = document.createElement('div')
  div.innerHTML = html
  document.body.appendChild(div)
  return div
}

function select(startNode, startOff, endNode, endOff) {
  const range = document.createRange()
  range.setStart(startNode, startOff)
  range.setEnd(endNode, endOff)
  const sel = window.getSelection()
  sel.removeAllRanges()
  sel.addRange(range)
  return sel
}

function types(selectors) {
  return selectors.map(s => s.type)
}

describe('selectionToSelectors — forced types', () => {
  it('returns a single TextQuoteSelector when forced', () => {
    const c = makeContainer('<p>Hello world</p>')
    const t = c.querySelector('p').firstChild
    const sel = select(t, 0, t, 5)
    const r = selectionToSelectors(sel, { container: c, selectorType: 'TextQuoteSelector' })
    expect(types(r.selectors)).toEqual(['TextQuoteSelector'])
    expect(r.selectors[0].exact).toBe('Hello')
  })

  it('returns a single TextPositionSelector when forced', () => {
    const c = makeContainer('<p>Hello world</p>')
    const t = c.querySelector('p').firstChild
    const r = selectionToSelectors(select(t, 0, t, 5), { container: c, selectorType: 'TextPositionSelector' })
    expect(types(r.selectors)).toEqual(['TextPositionSelector'])
    expect(r.selectors[0]).toMatchObject({ start: 0, end: 5 })
  })
})

describe('selectionToSelectors — auto policy', () => {
  it('same-node selection inside an [id] -> fragment (refined) + text quote/position', () => {
    const c = makeContainer('<div id="sec"><p>Hello world</p></div>')
    const t = c.querySelector('p').firstChild
    const r = selectionToSelectors(select(t, 0, t, 5), { container: c })
    expect(types(r.selectors)).toEqual(['FragmentSelector', 'TextQuoteSelector', 'TextPositionSelector'])
    const frag = r.selectors[0]
    expect(frag.value).toBe('sec')
    expect(types(frag.refinedBy)).toEqual(['TextQuoteSelector', 'TextPositionSelector'])
  })

  it('cross-node selection -> RangeSelector (XPath start/end) + text quote/position', () => {
    const c = makeContainer('<p>aaa</p><p>bbb</p>')
    const start = c.children[0].firstChild
    const end = c.children[1].firstChild
    const r = selectionToSelectors(select(start, 0, end, 3), { container: c })
    expect(types(r.selectors)).toEqual(['RangeSelector', 'TextQuoteSelector', 'TextPositionSelector'])
    const range = r.selectors[0]
    expect(range.startSelector.type).toBe('XPathSelector')
    expect(range.endSelector.type).toBe('XPathSelector')
    expect(types(range.startSelector.refinedBy)).toEqual(['TextQuoteSelector', 'TextPositionSelector'])
  })

  it('plain selection (no id, same node) -> text quote/position only', () => {
    const c = makeContainer('<p>Hello world</p>')
    const t = c.querySelector('p').firstChild
    const r = selectionToSelectors(select(t, 0, t, 5), { container: c })
    expect(types(r.selectors)).toEqual(['TextQuoteSelector', 'TextPositionSelector'])
  })
})

describe('selectionToSelectors — requestState', () => {
  it('attaches the TimeState -> HttpRequestState -> [quote, position] chain', () => {
    const c = makeContainer('<p>Hello world</p>')
    const t = c.querySelector('p').firstChild
    const r = selectionToSelectors(select(t, 0, t, 5), {
      container: c,
      requestState: { sourceDate: '2026-06-17T00:00:00.000Z', request: 'Accept: text/html' },
    })
    expect(r.state.type).toBe('TimeState')
    expect(r.state.sourceDate).toBe('2026-06-17T00:00:00.000Z')
    expect(r.state.refinedBy.type).toBe('HttpRequestState')
    expect(r.state.refinedBy.value).toBe('Accept: text/html')
    expect(types(r.state.refinedBy.refinedBy)).toEqual(['TextQuoteSelector', 'TextPositionSelector'])
  })

  it('omits state when no TextPositionSelector is produced', () => {
    const c = makeContainer('<p>Hello world</p>')
    const t = c.querySelector('p').firstChild
    const r = selectionToSelectors(select(t, 0, t, 5), {
      container: c,
      selectorType: 'TextQuoteSelector',
      requestState: { request: 'Accept: text/html' },
    })
    expect(r.state).toBeUndefined()
  })
})
