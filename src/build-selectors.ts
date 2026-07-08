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

import type {
  Selector,
  TextQuoteSelector,
  TextPositionSelector,
  XPathSelector,
  FragmentSelector,
  RangeSelector,
  State,
  TimeState,
  HttpRequestState,
} from './types.js'
import { generateId } from './id.js'
import { getTextContent, offsetInContainer } from './text-quote.js'

const DEFAULT_CONTEXT_LENGTH = 32
const RFC3987 = 'https://tools.ietf.org/html/rfc3987'

// Nearest declared language for an element, walking ancestors (incl. <html lang>).
function nearestLang(el: Element | null): string | undefined {
  const node = el?.closest('[lang], [xml\\:lang]')
  return node?.getAttribute('lang') || node?.getAttributeNS('', 'xml:lang') || undefined
}

// Range to TextQuoteSelector relative to container; ignoreSelector omits subtrees (e.g. injected markers) so the selector matches what resolution sees.
export function getTextQuoteSelector(
  range: Range,
  container: Element,
  options: { contextLength?: number; ignoreSelector?: string } = {}
): TextQuoteSelector {
  const contextLength = options.contextLength ?? DEFAULT_CONTEXT_LENGTH
  const { ignoreSelector } = options
  const language = nearestLang(container)

  if (ignoreSelector) {
    const text = getTextContent(container, ignoreSelector)
    const startOff = offsetInContainer(container, range.startContainer, range.startOffset, ignoreSelector)
    const endOff = offsetInContainer(container, range.endContainer, range.endOffset, ignoreSelector)
    return {
      type: 'TextQuoteSelector',
      id: generateId(),
      exact: text.slice(startOff, endOff),
      prefix: text.slice(Math.max(0, startOff - contextLength), startOff),
      suffix: text.slice(endOff, endOff + contextLength),
      ...(language && { language }),
    }
  }

  const doc = container.ownerDocument ?? document
  const exact = range.toString()

  const pre = doc.createRange()
  pre.selectNodeContents(container)
  pre.setEnd(range.startContainer, range.startOffset)
  const prefix = pre.toString().slice(-contextLength)

  const post = doc.createRange()
  post.selectNodeContents(container)
  post.setStart(range.endContainer, range.endOffset)
  const suffix = post.toString().slice(0, contextLength)

  return { type: 'TextQuoteSelector', id: generateId(), exact, prefix, suffix, ...(language && { language }) }
}

// Character offset of a boundary point within container (plain textContent).
function offsetWithinContainer(container: Element, node: Node, nodeOffset: number): number {
  const doc = container.ownerDocument ?? document
  const r = doc.createRange()
  r.selectNodeContents(container)
  r.setEnd(node, nodeOffset)
  return r.toString().length
}

// Range to TextPositionSelector, offsets relative to container; ignoreSelector excludes the same subtrees resolution skips.
export function getTextPositionSelector(
  range: Range,
  container: Element,
  options: { ignoreSelector?: string } = {}
): TextPositionSelector {
  const { ignoreSelector } = options
  const start = ignoreSelector
    ? offsetInContainer(container, range.startContainer, range.startOffset, ignoreSelector)
    : offsetWithinContainer(container, range.startContainer, range.startOffset)
  const end = ignoreSelector
    ? offsetInContainer(container, range.endContainer, range.endOffset, ignoreSelector)
    : offsetWithinContainer(container, range.endContainer, range.endOffset)
  return { type: 'TextPositionSelector', id: generateId(), start, end }
}

// Node to absolute positional XPath (/html[1]/body[1]/...), matching evaluateSimpleXPath.
export function getXPathSelector(node: Node): XPathSelector {
  let el: Element | null = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element)
  const steps: string[] = []
  while (el && el.nodeType === Node.ELEMENT_NODE) {
    const tag = el.tagName.toLowerCase()
    let index = 1
    for (let sib = el.previousElementSibling; sib; sib = sib.previousElementSibling) {
      if (sib.tagName.toLowerCase() === tag) index++
    }
    steps.unshift(`${tag}[${index}]`)
    el = el.parentElement
  }
  return { type: 'XPathSelector', id: generateId(), value: '/' + steps.join('/') }
}

// Nearest ancestor (or self) with an id to FragmentSelector, else null.
export function getFragmentSelector(
  node: Node,
  options: { climb?: boolean } = {}
): FragmentSelector | null {
  const climb = options.climb ?? true
  let el: Element | null = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element)
  while (el) {
    if (el.id) return { type: 'FragmentSelector', id: generateId(), value: el.id, conformsTo: RFC3987 }
    if (!climb) break
    el = el.parentElement
  }
  return null
}

export function getRangeSelector(startSelector: Selector, endSelector: Selector): RangeSelector {
  return { type: 'RangeSelector', id: generateId(), startSelector, endSelector }
}

export function refine<S extends Selector>(selector: S, refinedBy: Selector | Selector[]): S {
  return { ...selector, refinedBy }
}

// State builders; the library does no I/O, so the caller supplies the request date and header(s).
export function getTimeState(opts: {
  sourceDate?: string
  sourceDateStart?: string
  sourceDateEnd?: string
  cached?: string
  refinedBy?: State | State[]
}): TimeState {
  const s: TimeState = { type: 'TimeState', id: generateId() }
  if (opts.sourceDate) s.sourceDate = opts.sourceDate
  if (opts.sourceDateStart) s.sourceDateStart = opts.sourceDateStart
  if (opts.sourceDateEnd) s.sourceDateEnd = opts.sourceDateEnd
  if (opts.cached) s.cached = opts.cached
  if (opts.refinedBy) s.refinedBy = opts.refinedBy
  return s
}

export function getHttpRequestState(opts: {
  /** HTTP request header line(s), e.g. `Accept: text/html` */
  value: string | string[]
  refinedBy?: Selector | Selector[]
}): HttpRequestState {
  const s: HttpRequestState = { type: 'HttpRequestState', id: generateId(), value: opts.value }
  if (opts.refinedBy) s.refinedBy = opts.refinedBy
  return s
}

// Collect selectors nested under a state's refinedBy, walking state chains, since states do not themselves resolve to a range.
export function statesToSelectors(state: State | State[]): Selector[] {
  const states = Array.isArray(state) ? state : [state]
  const out: Selector[] = []
  for (const s of states) {
    if (!s.refinedBy) continue
    const refs = Array.isArray(s.refinedBy) ? s.refinedBy : [s.refinedBy]
    for (const r of refs) {
      if (r.type === 'TimeState' || r.type === 'HttpRequestState') out.push(...statesToSelectors(r))
      else out.push(r)
    }
  }
  return out
}
