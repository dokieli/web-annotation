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
  Annotation,
  AnnotationBodyObject,
  AnnotationCreator,
  Selector,
  State,
} from './types.js'
import { generateId } from './id.js'
import { purposeToken } from './purpose.js'

export const WEB_ANNOTATION_CONTEXT = 'http://www.w3.org/ns/anno.jsonld'

const OA_NS = 'http://www.w3.org/ns/oa#'
const LDP_NS = 'http://www.w3.org/ns/ldp#'

const PREFIX_TO_IRI: Record<string, string> = {
  'oa:': OA_NS,
  'as:': 'https://www.w3.org/ns/activitystreams#',
  'schema:': 'http://schema.org/',
  'dcterms:': 'http://purl.org/dc/terms/',
  'dc:': 'http://purl.org/dc/elements/1.1/',
  'foaf:': 'http://xmlns.com/foaf/0.1/',
  'rdf:': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
}

function expandIRI(value: string): string {
  for (const [prefix, ns] of Object.entries(PREFIX_TO_IRI)) {
    if (value.startsWith(prefix)) return ns + value.slice(prefix.length)
  }
  return value
}

// Full IRI to a prefixed name the WA context resolves (e.g. foaf:Person), else unchanged.
function compactIRI(value: string): string {
  for (const [prefix, ns] of Object.entries(PREFIX_TO_IRI)) {
    if (value.startsWith(ns)) return prefix + value.slice(ns.length)
  }
  return value
}

// oa: motivations become short WA tokens (oa:replying -> replying); non-WA ones expand to a full IRI.
function toMotivation(motivatedBy: string): string {
  if (motivatedBy.startsWith('oa:')) return motivatedBy.slice('oa:'.length)
  if (motivatedBy.startsWith(OA_NS)) return motivatedBy.slice(OA_NS.length)
  return expandIRI(motivatedBy)
}

// Fragment id matching the RDFa @resource/@about so both serializations identify the same node.
const frag = (id: string | undefined): string => `#${id ?? generateId()}`

function selectorRefinedByJSONLD(refinedBy: Selector | Selector[] | undefined): Record<string, unknown> {
  if (!refinedBy) return {}
  return { refinedBy: Array.isArray(refinedBy) ? refinedBy.map(selectorToJSONLD) : selectorToJSONLD(refinedBy) }
}

function selectorToJSONLD(selector: Selector): Record<string, unknown> {
  const refinedBy = selectorRefinedByJSONLD(selector.refinedBy)
  const id = frag(selector.id)

  switch (selector.type) {
    case 'TextQuoteSelector': {
      const tag = (v: string) => (selector.language ? { '@value': v, '@language': selector.language } : v)
      return {
        id,
        type: 'TextQuoteSelector',
        exact: tag(selector.exact),
        prefix: tag(selector.prefix ?? ''),
        suffix: tag(selector.suffix ?? ''),
        ...refinedBy,
      }
    }
    case 'FragmentSelector':
      return {
        id,
        type: 'FragmentSelector',
        value: selector.value,
        conformsTo: selector.conformsTo ?? 'https://tools.ietf.org/html/rfc3987',
        ...refinedBy,
      }
    case 'TextPositionSelector':
      return { id, type: 'TextPositionSelector', start: selector.start, end: selector.end, ...refinedBy }
    case 'XPathSelector':
      return { id, type: 'XPathSelector', value: selector.value, ...refinedBy }
    case 'RangeSelector':
      return {
        id,
        type: 'RangeSelector',
        startSelector: selectorToJSONLD(selector.startSelector),
        endSelector: selectorToJSONLD(selector.endSelector),
        ...refinedBy,
      }
  }
}

function stateRefinedByJSONLD(refinedBy: Selector | State | Array<Selector | State> | undefined): Record<string, unknown> {
  if (!refinedBy) return {}
  const toNode = (r: Selector | State): Record<string, unknown> =>
    r.type === 'TimeState' || r.type === 'HttpRequestState' ? stateToJSONLD(r) : selectorToJSONLD(r)
  return { refinedBy: Array.isArray(refinedBy) ? refinedBy.map(toNode) : toNode(refinedBy) }
}

function stateToJSONLD(state: State): Record<string, unknown> {
  const id = frag(state.id)
  if (state.type === 'HttpRequestState') {
    return { id, type: 'HttpRequestState', value: state.value, ...stateRefinedByJSONLD(state.refinedBy) }
  }

  const o: Record<string, unknown> = { id, type: 'TimeState' }
  if (state.sourceDate) o.sourceDate = state.sourceDate
  if (state.sourceDateStart) o.sourceDateStart = state.sourceDateStart
  if (state.sourceDateEnd) o.sourceDateEnd = state.sourceDateEnd
  if (state.cached) o.cached = state.cached
  return { ...o, ...stateRefinedByJSONLD(state.refinedBy) }
}

const RDF_HTML = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#HTML'

function bodyToJSONLD(body: AnnotationBodyObject): Record<string, unknown> {
  const value = body.format ? { '@value': body.value, '@type': RDF_HTML } : body.value
  const o: Record<string, unknown> = { id: frag(body.id), type: 'TextualBody', value }
  if (body.format) o.format = body.format
  // Well-known purposes compact to their short WA token; custom purposes stay as the given IRI.
  if (body.purpose) o.purpose = purposeToken(body.purpose)
  if (body.language) o['dcterms:language'] = body.language
  if (body.license) o['dcterms:license'] = { id: body.license }
  if (body.rights) o['dcterms:rights'] = { id: body.rights }
  return o
}

function creatorToJSONLD(creator: Partial<AnnotationCreator>): Record<string, unknown> | undefined {
  if (!creator || (!creator.iri && !creator.name && !creator.image && !creator.url)) return undefined
  const o: Record<string, unknown> = {}
  const types = (creator.type ? (Array.isArray(creator.type) ? creator.type : [creator.type]) : []).map(compactIRI)
  if (types.length) o.type = types.length === 1 ? types[0] : types
  if (creator.iri) o.id = creator.iri
  if (creator.name) o.name = creator.name
  if (creator.image) o.image = creator.image
  if (creator.url) o.homepage = creator.url
  return o
}

export interface JSONLDOptions {
  /** defaults to the Web Annotation context */
  context?: string | (string | Record<string, unknown>)[]
}

// Serializes an Annotation to a conformant W3C Web Annotation JSON-LD object.
export function serializeAnnotationToJSONLD(
  annotation: Annotation,
  options: JSONLDOptions = {}
): Record<string, unknown> {
  const context = options.context
    ?? (annotation.inbox ? [WEB_ANNOTATION_CONTEXT, { ldp: LDP_NS }] : WEB_ANNOTATION_CONTEXT)

  const jsonld: Record<string, unknown> = { '@context': context, type: 'Annotation' }

  jsonld.id = annotation.iri !== undefined ? annotation.iri : `#${annotation.id}`
  if (annotation.canonical) jsonld.canonical = annotation.canonical
  if (annotation.motivatedBy) jsonld.motivation = toMotivation(annotation.motivatedBy)
  if (annotation.datetime) jsonld.created = annotation.datetime

  if (annotation.language) jsonld['dcterms:language'] = annotation.language
  if (annotation.license) jsonld['dcterms:license'] = { id: annotation.license }
  if (annotation.rights) jsonld['dcterms:rights'] = { id: annotation.rights }
  if (annotation.inbox) jsonld['ldp:inbox'] = { id: annotation.inbox }

  const creator = creatorToJSONLD(annotation.creator)
  if (creator) jsonld.creator = creator

  // bodyValue (plain string body) takes precedence as per https://www.w3.org/TR/annotation-model/#string-body
  if (annotation.bodyValue) {
    jsonld.bodyValue = annotation.bodyValue
  } else {
    const bodies = (annotation.body ?? []).map(bodyToJSONLD)
    if (bodies.length === 1) jsonld.body = bodies[0]
    else if (bodies.length > 1) jsonld.body = bodies
  }

  // Target is a SpecificResource (with its own @id, distinct from source) when there is a selector/state, else just the IRI.
  const t = annotation.target
  const source = t?.source || t?.iri
  if (t?.selector || t?.state || t?.renderedVia) {
    const target: Record<string, unknown> = {}
    if (t.iri) target.id = t.iri
    target.type = 'SpecificResource'
    if (source) target.source = source
    if (t.selector) target.selector = selectorToJSONLD(t.selector)
    if (t.state) target.state = Array.isArray(t.state) ? t.state.map(stateToJSONLD) : stateToJSONLD(t.state)
    if (t.renderedVia?.iri) target.renderedVia = t.renderedVia.iri
    jsonld.target = target
  } else if (source) {
    jsonld.target = source
  }

  return jsonld
}
