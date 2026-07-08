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
  setSelectionByOffset,
  findTextQuoteOffsets,
} from './text-quote.js'
import { resolveSelectorToRange } from './resolve.js'
import type { Annotation, MarkOptions, Selector, TextQuoteSelector } from './types.js'
import { DCMITYPE_TEXT, defaultReference } from './mark.js'

// Builds a <mark rdf:value> with the given id; repeated per segment of a highlight.
function makeMark(options: MarkOptions, markId: string): HTMLElement {
  const mark = document.createElement('mark')
  mark.setAttribute('datatype', 'rdf:HTML')
  mark.setAttribute('property', 'rdf:value')
  mark.id = markId
  for (const [k, v] of Object.entries(options.markAttrs ?? {})) mark.setAttribute(k, v)
  return mark
}

function appendChildrenHTML(parent: Element, html: string): void {
  const tmp = (parent.ownerDocument ?? document).createElement('span')
  tmp.innerHTML = html
  while (tmp.firstChild) parent.appendChild(tmp.firstChild)
}

// True when `range` overlaps any of `node`'s content, even partially.
function nodeOverlapsRange(range: Range, node: Node): boolean {
  const r = (node.ownerDocument ?? document).createRange()
  r.selectNodeContents(node)
  // overlap iff range.start < node.end AND range.end > node.start
  return range.compareBoundaryPoints(Range.END_TO_START, r) < 0
    && range.compareBoundaryPoints(Range.START_TO_END, r) > 0
}

// Text nodes (document order) the range overlaps; text inside an `ignoreSelector` subtree is excluded.
function collectRangeTextNodes(range: Range, ignoreSelector?: string): Text[] {
  const ca = range.commonAncestorContainer
  if (ca.nodeType === Node.TEXT_NODE) return [ca as Text]

  const walker = (ca.ownerDocument ?? document).createTreeWalker(ca, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  let n = walker.nextNode()
  while (n) {
    const ignored = ignoreSelector && (n as Text).parentElement?.closest(ignoreSelector)
    if (!ignored && nodeOverlapsRange(range, n)) nodes.push(n as Text)
    n = walker.nextNode()
  }
  return nodes
}

// Wraps the range's text in <span dcterms:hasPart ...><mark rdf:value>...</mark></span>, one per text node to avoid spanning block boundaries; `reference` (or the default link) is appended after the final mark.
// Each segment gets a unique id derived from options.id. Returns the last span, or null.
export function applyMark(range: Range, options: MarkOptions & { ignoreSelector?: string }): Element | null {
  const textNodes = collectRangeTextNodes(range, options.ignoreSelector)
  let lastSpan: Element | null = null
  let seg = 0

  for (const tn of textNodes) {
    const startOff = tn === range.startContainer ? range.startOffset : 0
    const endOff = tn === range.endContainer ? range.endOffset : tn.length
    if (endOff <= startOff) continue

    const doc = tn.ownerDocument ?? document
    const sub = doc.createRange()
    sub.setStart(tn, startOff)
    sub.setEnd(tn, endOff)

    const markId = options.id
      ? (seg === 0 ? options.id : `${options.id}-${seg}`)
      : crypto.randomUUID()
    const mark = makeMark(options, markId)
    try {
      sub.surroundContents(mark)
    } catch {
      continue // skip segments that can't be cleanly wrapped
    }

    const span = doc.createElement('span')
    if (options.className) span.className = options.className
    span.setAttribute('rel', 'dcterms:hasPart')
    span.setAttribute('resource', `#${markId}`)
    span.setAttribute('typeof', DCMITYPE_TEXT)
    for (const [k, v] of Object.entries(options.wrapperAttrs ?? {})) span.setAttribute(k, v)
    mark.parentNode!.insertBefore(span, mark)
    span.appendChild(mark)
    lastSpan = span
    seg++
  }

  if (lastSpan) appendChildrenHTML(lastSpan, options.reference ?? defaultReference(options.annotationUrl))
  return lastSpan
}

// Marks every occurrence of the selector's phrase; returns the last span or null.
export function applyMarksFromTextQuote(
  container: Element,
  selector: Pick<TextQuoteSelector, 'exact' | 'prefix' | 'suffix'>,
  options: MarkOptions & { excludeMatchesIn?: string; ignoreSelector?: string }
): Element | null {
  let lastSpan: Element | null = null
  const matchOptions = { ignoreSelector: options.ignoreSelector }

  for (const { start, end } of findTextQuoteOffsets(container, selector, matchOptions)) {
    setSelectionByOffset(start, end, container, matchOptions)

    const selection = window.getSelection()
    if (!selection || !selection.rangeCount) continue

    const range = selection.getRangeAt(0)
    selection.removeAllRanges()

    if (options.excludeMatchesIn) {
      const node = range.startContainer
      const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
      if (el?.closest(options.excludeMatchesIn)) continue
    }

    const span = applyMark(range, options)
    if (span) lastSpan = span
  }

  return lastSpan
}

// Resolves any selector type to a DOM range and marks it. Returns the last span, or null.
export function applyMarkFromSelector(
  container: Element,
  selector: Selector,
  options: MarkOptions & { excludeMatchesIn?: string; ignoreSelector?: string }
): Element | null {
  const range = resolveSelectorToRange(container, selector, { ignoreSelector: options.ignoreSelector })
  if (!range) return null

  if (options.excludeMatchesIn) {
    const start = range.startContainer
    const startEl = start.nodeType === Node.ELEMENT_NODE ? (start as Element) : start.parentElement
    if (startEl?.closest(options.excludeMatchesIn)) return null
  }

  return applyMark(range, options)
}

// Marks stored annotations by resolving each selector in `container`; URL defaults to `annotation.iri`. Skips unresolvable selectors and annotations without a URL. Call on page load.
export function restoreMarks(
  container: Element,
  annotations: Annotation[],
  options?: {
    className?: string
    getAnnotationUrl?: (annotation: Annotation) => string | undefined
    getId?: (annotation: Annotation) => string | undefined
    getReference?: (annotation: Annotation) => string | undefined
    /** CSS selector; matches inside it are skipped */
    excludeMatchesIn?: string
    /** CSS selector; matching subtrees omitted from the text basis */
    ignoreSelector?: string
  }
): void {
  for (const annotation of annotations) {
    const selector = annotation.target.selector
    if (!selector) continue

    const annotationUrl = options?.getAnnotationUrl?.(annotation) ?? annotation.iri
    if (!annotationUrl) continue

    applyMarkFromSelector(container, selector, {
      annotationUrl,
      id: options?.getId?.(annotation),
      className: options?.className,
      reference: options?.getReference?.(annotation),
      excludeMatchesIn: options?.excludeMatchesIn,
      ignoreSelector: options?.ignoreSelector,
    })
  }
}
