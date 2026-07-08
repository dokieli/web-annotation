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

import type { Selector } from './types.js'
import { setSelectionFromTextQuote, setSelectionByOffset, type TextMatchOptions } from './text-quote.js'

// Resolves a positional XPath (e.g. /html[1]/body[1]/p[2]) by walking element children, for envs lacking document.evaluate.
function evaluateSimpleXPath(doc: Document, xpath: string): Node | null {
  const steps = xpath.split('/').filter(Boolean)
  let current: Node = doc
  for (const step of steps) {
    const m = step.match(/^([A-Za-z_][\w.-]*)(?:\[(\d+)\])?$/)
    if (!m) return null
    const name = m[1].toLowerCase()
    const index = m[2] ? parseInt(m[2], 10) : 1
    let count = 0
    let found: Element | null = null
    for (const child of Array.from(current.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE && (child as Element).tagName.toLowerCase() === name) {
        if (++count === index) { found = child as Element; break }
      }
    }
    if (!found) return null
    current = found
  }
  return current === doc ? null : current
}

function evaluateXPath(containerNode: Element, xpath: string): Node | null {
  const doc = containerNode.ownerDocument ?? document
  const evaluate = (doc as unknown as { evaluate?: Document['evaluate'] }).evaluate
  if (typeof evaluate === 'function') {
    try {
      // 9 === XPathResult.FIRST_ORDERED_NODE_TYPE
      const node = evaluate.call(doc, xpath, doc, null, 9, null).singleNodeValue
      if (node) return node
    } catch {
      // fall through to positional evaluator
    }
  }
  return evaluateSimpleXPath(doc, xpath)
}

// Resolve `refinedBy` within an element; an array is co-equal alternatives (W3C §4.2: first that resolves wins).
function applyRefinements(scope: Element, refinedBy: Selector | Selector[], options: TextMatchOptions): Range | null {
  const refs = Array.isArray(refinedBy) ? refinedBy : [refinedBy]
  for (const ref of refs) {
    const refined = resolveSelectorToRange(scope, ref, options)
    if (refined) return refined
  }
  return null
}

// Resolves any selector type to a live DOM Range within containerNode, or null if it can't be located.
export function resolveSelectorToRange(
  containerNode: Element,
  selector: Selector,
  options: TextMatchOptions = {}
): Range | null {
  const doc = containerNode.ownerDocument ?? document

  switch (selector.type) {
    case 'TextQuoteSelector': {
      if (!setSelectionFromTextQuote(containerNode, selector, options)) return null
      const sel = window.getSelection()
      if (!sel || !sel.rangeCount) return null
      const range = sel.getRangeAt(0).cloneRange()
      sel.removeAllRanges()
      return range
    }

    case 'TextPositionSelector': {
      setSelectionByOffset(selector.start, selector.end, containerNode, options)
      const sel = window.getSelection()
      if (!sel || !sel.rangeCount) return null
      const range = sel.getRangeAt(0).cloneRange()
      sel.removeAllRanges()
      return range
    }

    case 'XPathSelector': {
      const node = evaluateXPath(containerNode, selector.value)
      if (!node) return null
      if (selector.refinedBy && node.nodeType === Node.ELEMENT_NODE) {
        const refined = applyRefinements(node as Element, selector.refinedBy, options)
        if (refined) return refined
      }
      const range = doc.createRange()
      range.selectNodeContents(node)
      return range
    }

    case 'RangeSelector': {
      const startRange = resolveSelectorToRange(containerNode, selector.startSelector, options)
      const endRange = resolveSelectorToRange(containerNode, selector.endSelector, options)
      if (!startRange || !endRange) return null
      const range = doc.createRange()
      range.setStart(startRange.startContainer, startRange.startOffset)
      range.setEnd(endRange.endContainer, endRange.endOffset)
      return range
    }

    case 'FragmentSelector': {
      // Treat the fragment value as an element id, narrowed by refinedBy.
      const node = doc.getElementById(selector.value)
      if (!node) return null
      if (selector.refinedBy) {
        const refined = applyRefinements(node, selector.refinedBy, options)
        if (refined) return refined
      }
      const range = doc.createRange()
      range.selectNodeContents(node)
      return range
    }

    default:
      return null
  }
}
