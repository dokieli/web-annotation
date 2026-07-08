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

export interface ClonedRange {
  range: Range
  fragment: DocumentFragment
}

// Parent element of a range (handles single-node, text-start, element-start).
export function getSelectedParentElement(range: Range): Element | null {
  if (!range) return null

  if (
    rangeSelectsSingleNode(range) &&
    (range.startContainer.childNodes[range.startOffset] as Node).nodeType !== 3
  ) {
    return range.startContainer.childNodes[range.startOffset] as Element
  }

  if (range.startContainer.nodeType === 3) {
    return range.startContainer.parentNode as Element | null
  }

  return range.startContainer as Element
}

// True if the range selects exactly one child node of its container.
export function rangeSelectsSingleNode(range: Range): boolean {
  const startNode = range.startContainer
  return (
    startNode === range.endContainer &&
    startNode.hasChildNodes() &&
    range.endOffset === range.startOffset + 1
  )
}

// Character offsets of the selection relative to selectedParentElement.
export function exportSelection(
  selectedParentElement: Element,
  selection: Selection
): { start: number; end: number } | undefined {
  if (!selection.rangeCount) return

  const ranges = Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i))

  const mergedRange = document.createRange()
  mergedRange.setStart(ranges[0].startContainer, ranges[0].startOffset)
  mergedRange.setEnd(ranges[ranges.length - 1].endContainer, ranges[ranges.length - 1].endOffset)

  const preSelectionRange = mergedRange.cloneRange()
  preSelectionRange.selectNodeContents(selectedParentElement)
  preSelectionRange.setEnd(mergedRange.startContainer, mergedRange.startOffset)
  const start = preSelectionRange.toString().length

  return { start, end: start + mergedRange.toString().length }
}

// Snapshots the current selection so it survives focus changes (e.g. forms).
export function cloneSelection(): ClonedRange[] | null {
  const selection = window.getSelection()
  if (!selection?.rangeCount) return null

  return Array.from({ length: selection.rangeCount }, (_, i) => {
    const range = selection.getRangeAt(i).cloneRange()
    return { range, fragment: range.cloneContents() }
  })
}

// Restores a selection cloned by cloneSelection().
export function restoreSelection(clonedSelection: ClonedRange[] | null): void {
  const selection = window.getSelection()
  if (!selection) return
  selection.removeAllRanges()
  if (!clonedSelection) return
  clonedSelection.forEach(({ range }) => selection.addRange(range))
}
