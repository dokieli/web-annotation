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

import type { Annotation, MarkOptions } from './types.js'

export const DCMITYPE_TEXT = 'http://purl.org/dc/dcmitype/Text'

function htmlEncode(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function attrsToString(attrs: Record<string, string | undefined>): string {
  return Object.entries(attrs)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ` ${k}="${v}"`)
    .join('')
}

// Default reference marker: a link from the fragment to its annotation resource. Callers override via MarkOptions.reference (e.g. a <sup> with a motivation-specific relation).
export function defaultReference(annotationUrl: string): string {
  return `<a href="${annotationUrl}" rel="rdfs:seeAlso">${annotationUrl}</a>`
}

// Static HTML form of an annotation's highlight. For live-DOM marking use applyMark (dom-mark.ts).
export function createAnnotationMarkHTML(annotation: Annotation, options: MarkOptions): string {
  const selector = annotation.target.selector
  const exact = selector && selector.type === 'TextQuoteSelector' ? selector.exact : ''
  const id = options.id ?? `r-${annotation.id}`
  return markSegmentHTML(htmlEncode(exact), { ...options, id })
}

// Builds <span dcterms:hasPart ...><mark rdf:value>...</mark>{reference}</span>. contentHTML must be pre-escaped.
export function markSegmentHTML(contentHTML: string, options: MarkOptions): string {
  const { annotationUrl, id, className, reference, wrapperAttrs, markAttrs } = options
  const markId = id ?? crypto.randomUUID()

  const span = attrsToString({
    class: className,
    rel: 'dcterms:hasPart',
    resource: `#${markId}`,
    typeof: DCMITYPE_TEXT,
    ...wrapperAttrs,
  })
  const mark = attrsToString({
    datatype: 'rdf:HTML',
    property: 'rdf:value',
    id: markId,
    ...markAttrs,
  })
  const ref = reference ?? defaultReference(annotationUrl)
  return `<span${span}><mark${mark}>${contentHTML}</mark>${ref}</span>`
}
