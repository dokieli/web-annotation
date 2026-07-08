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

import {
  getTextQuoteSelector,
  getTextPositionSelector,
  getXPathSelector,
  getFragmentSelector,
  getRangeSelector,
  refine,
  getTimeState,
  getHttpRequestState,
} from './build-selectors.js'
import type { Selector, State } from './types.js'

export type SelectorType =
  | 'TextQuoteSelector'
  | 'TextPositionSelector'
  | 'FragmentSelector'
  | 'XPathSelector'
  | 'RangeSelector'
  | 'auto'

// Caller-supplied request metadata; lib does no fetching.
export interface RequestStateInput {
  sourceDate?: string
  sourceDateStart?: string
  sourceDateEnd?: string
  cached?: string
  /** HTTP request header(s) */
  request: string | string[]
}

export interface SelectionToSelectorsOptions {
  /** measuring root for top-level quote/position */
  container: Element
  /** default `auto` */
  selectorType?: SelectorType
  contextLength?: number
  /** subtrees omitted from offset/quote measurement */
  ignoreSelector?: string
  requestState?: RequestStateInput
}

export interface SelectorsResult {
  /** co-equal alternatives; consumer picks one (W3C §4.2) */
  selectors: Selector[]
  /** `target.state`, set when requestState was supplied */
  state?: State
}

function elementOf(node: Node): Element {
  return (node.nodeType === Node.TEXT_NODE ? node.parentElement : node) as Element
}

function closestWithId(node: Node): Element | null {
  let el: Element | null = elementOf(node)
  while (el) {
    if (el.id) return el
    el = el.parentElement
  }
  return null
}

// Portion of the selection within the start element (start to end of node).
function startSubRange(range: Range, startEl: Element): Range {
  const r = range.cloneRange()
  r.selectNodeContents(startEl)
  r.setStart(range.startContainer, range.startOffset)
  return r
}

// Portion of the selection within the end element (start of node to end).
function endSubRange(range: Range, endEl: Element): Range {
  const r = range.cloneRange()
  r.selectNodeContents(endEl)
  r.setEnd(range.endContainer, range.endOffset)
  return r
}

interface RuleContext {
  range: Range
  container: Element
  sameNode: boolean
  startEl: Element
  endEl: Element
  fragmentEl: Element | null
  ctxOpts: { contextLength?: number; ignoreSelector?: string }
}

interface Rule {
  name: string
  when: (ctx: RuleContext) => boolean
  build: (ctx: RuleContext) => Selector[]
}

// Every matching rule contributes selectors to the result set.
const RULES: Rule[] = [
  {
    // Same start/end text node with an identifiable fragment ancestor.
    name: 'fragment',
    when: ctx => ctx.sameNode && ctx.fragmentEl !== null,
    build: ctx => [
      refine(getFragmentSelector(ctx.fragmentEl!)!, [
        getTextQuoteSelector(ctx.range, ctx.fragmentEl!, ctx.ctxOpts),
        getTextPositionSelector(ctx.range, ctx.fragmentEl!, ctx.ctxOpts),
      ]),
    ],
  },
  {
    // Cross-node selection anchored structurally via XPath start/end.
    name: 'range',
    when: ctx => !ctx.sameNode,
    build: ctx => {
      const startSel = refine(getXPathSelector(ctx.startEl), [
        getTextQuoteSelector(startSubRange(ctx.range, ctx.startEl), ctx.startEl, ctx.ctxOpts),
        getTextPositionSelector(startSubRange(ctx.range, ctx.startEl), ctx.startEl, ctx.ctxOpts),
      ])
      const endSel = refine(getXPathSelector(ctx.endEl), [
        getTextQuoteSelector(endSubRange(ctx.range, ctx.endEl), ctx.endEl, ctx.ctxOpts),
        getTextPositionSelector(endSubRange(ctx.range, ctx.endEl), ctx.endEl, ctx.ctxOpts),
      ])
      return [getRangeSelector(startSel, endSel)]
    },
  },
  {
    // Always fires: top-level quote + position against the container.
    name: 'text',
    when: () => true,
    build: ctx => [
      getTextQuoteSelector(ctx.range, ctx.container, ctx.ctxOpts),
      getTextPositionSelector(ctx.range, ctx.container, ctx.ctxOpts),
    ],
  },
]

function buildAuto(range: Range, container: Element, ctxOpts: { contextLength?: number; ignoreSelector?: string }): Selector[] {
  const ctx: RuleContext = {
    range,
    container,
    ctxOpts,
    sameNode: range.startContainer === range.endContainer,
    startEl: elementOf(range.startContainer),
    endEl: elementOf(range.endContainer),
    fragmentEl: closestWithId(range.commonAncestorContainer),
  }
  return RULES.filter(r => r.when(ctx)).flatMap(r => r.build(ctx))
}

// TimeState refinedBy HttpRequestState refinedBy [quote, position]; needs a TextPositionSelector.
function buildState(selectors: Selector[], input: RequestStateInput): State | undefined {
  const tp = selectors.find(s => s.type === 'TextPositionSelector')
  if (!tp) return undefined
  const tq = selectors.find(s => s.type === 'TextQuoteSelector')
  const refinedBy = [tq, tp].filter(Boolean) as Selector[]
  const http = getHttpRequestState({ value: input.request, refinedBy })
  return getTimeState({
    sourceDate: input.sourceDate,
    sourceDateStart: input.sourceDateStart,
    sourceDateEnd: input.sourceDateEnd,
    cached: input.cached,
    refinedBy: http,
  })
}

// Range to selector(s); a forced selectorType yields one selector, 'auto' runs the rule table. requestState attaches a TimeState chain.
export function rangeToSelectors(
  range: Range,
  options: SelectionToSelectorsOptions
): SelectorsResult | null {
  const { container, selectorType = 'auto', contextLength, ignoreSelector, requestState } = options
  const ctxOpts = { contextLength, ignoreSelector }

  let selectors: Selector[]
  switch (selectorType) {
    case 'TextQuoteSelector':
      selectors = [getTextQuoteSelector(range, container, ctxOpts)]
      break
    case 'TextPositionSelector':
      selectors = [getTextPositionSelector(range, container, ctxOpts)]
      break
    case 'XPathSelector':
      selectors = [getXPathSelector(elementOf(range.commonAncestorContainer))]
      break
    case 'FragmentSelector': {
      const f = getFragmentSelector(range.commonAncestorContainer)
      if (!f) return null
      selectors = [f]
      break
    }
    case 'RangeSelector':
    case 'auto':
    default:
      selectors = buildAuto(range, container, ctxOpts)
  }

  const result: SelectorsResult = { selectors }
  if (requestState) {
    const state = buildState(selectors, requestState)
    if (state) result.state = state
  }
  return result
}

// DOM Selection wrapper over rangeToSelectors; uses the first range.
export function selectionToSelectors(
  selection: Selection,
  options: SelectionToSelectorsOptions
): SelectorsResult | null {
  if (!selection.rangeCount) return null
  return rangeToSelectors(selection.getRangeAt(0), options)
}
