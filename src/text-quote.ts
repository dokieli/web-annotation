import type { TextQuoteSelector } from './types.js'
import { getTextQuoteSelector } from './build-selectors.js'

// `ignoreSelector` names subtrees to omit from offset math and phrase lookup (e.g. injected decorations).
export interface TextMatchOptions {
  ignoreSelector?: string
}

function isIgnored(node: Node, ignoreSelector?: string): boolean {
  return !!ignoreSelector
    && node.nodeType === Node.ELEMENT_NODE
    && (node as Element).matches(ignoreSelector)
}

// textContent of `container`, skipping subtrees matching `ignoreSelector` to keep offsets aligned across the other walks.
export function getTextContent(container: Node, ignoreSelector?: string): string {
  if (!ignoreSelector) return container.textContent ?? ''
  let text = ''
  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) { text += node.textContent ?? ''; return }
    if (isIgnored(node, ignoreSelector)) return
    for (const child of node.childNodes) walk(child)
  }
  walk(container)
  return text
}

// Character offset of a DOM position within `container`, counting the same text as getTextContent. Inverse of setSelectionByOffset.
export function offsetInContainer(
  container: Node,
  boundaryNode: Node,
  boundaryOffset: number,
  ignoreSelector?: string
): number {
  let count = 0
  let found = -1
  const walk = (node: Node): boolean => {
    if (node === boundaryNode) {
      if (node.nodeType === Node.TEXT_NODE) {
        found = count + boundaryOffset
      } else {
        let i = 0
        for (const child of node.childNodes) {
          if (i === boundaryOffset) { found = count; return true }
          if (walk(child)) return true
          i++
        }
        found = count
      }
      return true
    }
    if (node.nodeType === Node.TEXT_NODE) { count += node.textContent?.length ?? 0; return false }
    if (isIgnored(node, ignoreSelector)) return false
    for (const child of node.childNodes) { if (walk(child)) return true }
    return false
  }
  walk(container)
  return found === -1 ? count : found
}

// DOM selection to TextQuoteSelector, with `contextLength` chars of prefix/suffix.
export function selectionToTextQuote(
  containerNode: Element,
  selection: Selection,
  options: { contextLength?: number } = {}
): TextQuoteSelector | null {
  if (!selection.rangeCount) return null
  return getTextQuoteSelector(selection.getRangeAt(0), containerNode, options)
}

// Selects `exact` (disambiguated by prefix/suffix) within containerNode; returns whether it was found.
export function setSelectionFromTextQuote(
  containerNode: Element,
  { exact, prefix, suffix }: Pick<TextQuoteSelector, 'exact' | 'prefix' | 'suffix'>,
  options: TextMatchOptions = {}
): boolean {
  const text = getTextContent(containerNode, options.ignoreSelector)
  const search = (prefix || '') + exact + (suffix || '')

  let start = -1
  if (search.length > 0) {
    const idx = text.indexOf(search)
    if (idx !== -1) start = idx + (prefix || '').length
  }

  if (start === -1 && exact) {
    start = text.indexOf(exact)
  }

  if (start === -1) return false

  setSelectionByOffset(start, start + exact.length, containerNode, options)
  return true
}

// Selects a character offset range within containerNode.
export function setSelectionByOffset(
  start: number,
  end: number,
  containerNode: Element,
  options: TextMatchOptions = {}
): void {
  const { ignoreSelector } = options
  const range = document.createRange()
  const selection = window.getSelection()
  let charIndex = 0

  function traverse(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const next = charIndex + (node.textContent?.length ?? 0)
      if (charIndex <= start && next >= start) {
        range.setStart(node, start - charIndex)
      }
      if (charIndex <= end && next >= end) {
        range.setEnd(node, end - charIndex)
      }
      charIndex = next
    } else {
      if (isIgnored(node, ignoreSelector)) return
      for (const child of node.childNodes) traverse(child)
    }
  }

  traverse(containerNode)
  selection?.removeAllRanges()
  selection?.addRange(range)
}

// Offset range of `exact` for every occurrence of the prefix+exact+suffix phrase.
export function findTextQuoteOffsets(
  containerNode: Element,
  { exact, prefix, suffix }: Pick<TextQuoteSelector, 'exact' | 'prefix' | 'suffix'>,
  options: TextMatchOptions = {}
): Array<{ start: number; end: number }> {
  const text = getTextContent(containerNode, options.ignoreSelector)
  const p = prefix || ''
  const e = exact || ''
  const s = suffix || ''
  const phrase = p + e + s
  if (!phrase.length) return []

  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(escaped, 'g')
  const ranges: Array<{ start: number; end: number }> = []

  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const start = m.index + p.length
    ranges.push({ start, end: start + e.length })
    // Guard against zero-width phrases looping forever.
    if (m.index === re.lastIndex) re.lastIndex++
  }

  return ranges
}
