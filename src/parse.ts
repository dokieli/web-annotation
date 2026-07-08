import type {
  Annotation,
  AnnotationBodyObject,
  Selector,
  TextQuoteSelector,
  FragmentSelector,
  TextPositionSelector,
  XPathSelector,
  RangeSelector,
  State,
  TimeState,
  HttpRequestState,
} from './types.js'
import { purposeToken } from './purpose.js'

const OA = 'http://www.w3.org/ns/oa#'
const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
const DCTERMS = 'http://purl.org/dc/terms/'
const DC = 'http://purl.org/dc/elements/1.1/'
const FOAF = 'http://xmlns.com/foaf/0.1/'
const SCHEMA = 'http://schema.org/'
const LDP = 'http://www.w3.org/ns/ldp#'

// Candidate keys per property, tried in order, tolerating expanded, prefixed, and compact JSON-LD shapes.
const P = {
  type:            ['@type', 'type'],
  id:              ['@id', 'id'],
  motivatedBy:     [`${OA}motivatedBy`, 'oa:motivatedBy', 'motivation', 'motivatedBy'],
  hasTarget:       [`${OA}hasTarget`, 'oa:hasTarget', 'target'],
  hasSource:       [`${OA}hasSource`, 'oa:hasSource', 'source'],
  hasSelector:     [`${OA}hasSelector`, 'oa:hasSelector', 'selector'],
  hasState:        [`${OA}hasState`, 'oa:hasState', 'state'],
  refinedBy:       [`${OA}refinedBy`, 'oa:refinedBy', 'refinedBy'],
  hasStartSelector:[`${OA}hasStartSelector`, 'oa:hasStartSelector', 'startSelector'],
  hasEndSelector:  [`${OA}hasEndSelector`, 'oa:hasEndSelector', 'endSelector'],
  exact:           [`${OA}exact`, 'oa:exact', 'exact'],
  prefix:          [`${OA}prefix`, 'oa:prefix', 'prefix'],
  suffix:          [`${OA}suffix`, 'oa:suffix', 'suffix'],
  start:           [`${OA}start`, 'oa:start', 'start'],
  end:             [`${OA}end`, 'oa:end', 'end'],
  rdfValue:        [`${RDF}value`, 'rdf:value', 'value'],
  hasPurpose:      [`${OA}hasPurpose`, 'oa:hasPurpose', 'purpose'],
  hasBody:         [`${OA}hasBody`, 'oa:hasBody', 'body'],
  bodyValue:       [`${OA}bodyValue`, 'oa:bodyValue', 'bodyValue'],
  conformsTo:      [`${DCTERMS}conformsTo`, 'dcterms:conformsTo', 'conformsTo'],
  cached:          [`${OA}cachedSource`, 'oa:cachedSource', 'cached'],
  sourceDate:      [`${OA}sourceDate`, 'oa:sourceDate', 'sourceDate'],
  sourceDateStart: [`${OA}sourceDateStart`, 'oa:sourceDateStart', 'sourceDateStart'],
  sourceDateEnd:   [`${OA}sourceDateEnd`, 'oa:sourceDateEnd', 'sourceDateEnd'],
  canonical:       [`${OA}canonical`, 'oa:canonical', 'canonical'],
  renderedVia:     [`${OA}renderedVia`, 'oa:renderedVia', 'renderedVia'],
  created:         [`${DCTERMS}created`, 'dcterms:created', 'created'],
  creator:         [`${DCTERMS}creator`, 'dcterms:creator', 'creator'],
  name:            [`${FOAF}name`, 'foaf:name', 'name', `${SCHEMA}name`, 'schema:name'],
  image:           [`${SCHEMA}image`, 'schema:image', 'image'],
  description:     [`${SCHEMA}description`, 'schema:description', 'description'],
  language:        [`${DC}language`, 'dc:language', 'language', `${DCTERMS}language`, 'dcterms:language'],
  format:          [`${DC}format`, 'dc:format', 'format', `${DCTERMS}format`, 'dcterms:format'],
  license:         [`${DCTERMS}license`, 'dcterms:license', 'license', `${SCHEMA}license`, 'schema:license' ],
  rights:          [`${DCTERMS}rights`, 'dcterms:rights', 'rights'],
  inbox:           [`${LDP}inbox`, 'ldp:inbox', 'inbox'],
} as const

type Node = Record<string, unknown>

function get(node: Node | undefined, keys: readonly string[]): unknown {
  if (!node) return undefined
  for (const k of keys) {
    if (k in node && node[k] !== undefined) return node[k]
  }
  return undefined
}

function nodeId(node: Node | undefined): string | undefined {
  return node ? ((node['@id'] ?? node['id']) as string | undefined) : undefined
}

// Stored node id stripped of a leading '#'; blank nodes (`_:x`) are anonymous and yield no id.
function fragmentId(node: Node | undefined): string | undefined {
  const id = nodeId(node)
  if (!id || id.startsWith('_:')) return undefined
  return id.startsWith('#') ? id.slice(1) : id
}

// Extracts the local name from an IRI, prefixed token, or node reference.
function localName(token: unknown): string {
  if (typeof token !== 'string') {
    const id = token && typeof token === 'object' ? ((token as Node)['@id'] ?? (token as Node).id) : undefined
    token = typeof id === 'string' ? id : ''
  }
  const t = token as string
  const hash = t.lastIndexOf('#')
  if (hash >= 0) return t.slice(hash + 1)
  if (t.startsWith('http://') || t.startsWith('https://')) {
    const slash = t.lastIndexOf('/')
    return slash >= 0 ? t.slice(slash + 1) : t
  }
  const colon = t.indexOf(':')
  return colon >= 0 ? t.slice(colon + 1) : t
}

function typeLocalNames(node: Node | undefined): string[] {
  let v = get(node, P.type)
  if (v == null) return []
  if (!Array.isArray(v)) v = [v]
  return (v as unknown[]).map(localName).filter(Boolean)
}

function isType(node: Node | undefined, ...localNames: string[]): boolean {
  const names = typeLocalNames(node)
  return localNames.some(n => names.includes(n))
}

// Resolves an embedded object, an {@id} reference into the graph, or a bare string IRI to a node.
function resolveRef(graph: Node[], value: unknown): Node | undefined {
  if (value == null) return undefined
  if (Array.isArray(value)) return resolveRef(graph, value[0])

  if (typeof value === 'string') {
    return graph.find(n => nodeId(n) === value)
  }

  if (typeof value === 'object') {
    const obj = value as Node
    const ownKeys = Object.keys(obj).filter(k => k !== '@id' && k !== 'id' && k !== '@context')
    if (ownKeys.length > 0) return obj // embedded node
    const idv = (obj['@id'] ?? obj['id']) as string | undefined
    if (idv) return graph.find(n => nodeId(n) === idv) ?? obj
  }
  return undefined
}

function iriValue(value: unknown): string | undefined {
  if (value == null) return undefined
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return iriValue(value[0])
  if (typeof value === 'object') {
    const v = value as Node
    return (v['@id'] ?? v['id']) as string | undefined
  }
  return undefined
}

function stringValue(value: unknown): string | undefined {
  if (value == null) return undefined
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return stringValue(value[0])
  if (typeof value === 'object') {
    const v = value as Node
    if ('@value' in v) return String(v['@value'])
    if ('@id' in v) return v['@id'] as string
    if ('id' in v) return v['id'] as string
  }
  return undefined
}

function langValue(value: unknown): string | undefined {
  if (Array.isArray(value)) return langValue(value[0])
  if (value && typeof value === 'object' && '@language' in (value as Node)) {
    return (value as Node)['@language'] as string
  }
  return undefined
}

function numberValue(value: unknown): number {
  const s = stringValue(value)
  const n = s === undefined ? NaN : Number(s)
  return Number.isFinite(n) ? n : 0
}

export type JSONLDNode = Record<string, unknown>

// Locates the annotation node by IRI, falling back to id matching or the first annotation.
function findAnnotationNode(graph: Node[], annotationIRI?: string): Node | undefined {
  if (annotationIRI) {
    const matched = graph.find(node => isType(node, 'Annotation') && (nodeId(node) === annotationIRI || nodeId(node) === ''))
    if (matched) return matched
  }
  return graph.find(node => isType(node, 'Annotation'))
}

export function parseStoredAnnotation(
  input: JSONLDNode | JSONLDNode[],
  annotationIRI?: string
): Annotation | null {
  const graph = toGraph(input)

  const annotationNode = findAnnotationNode(graph, annotationIRI)

  if (!annotationNode) return null

  const motivated = expandMotivation(iriValue(get(annotationNode, P.motivatedBy)))
  if (!motivated) return null

  // Target: string IRI, inline SpecificResource, or @id reference.
  const targetRef = get(annotationNode, P.hasTarget)
  const targetNode = resolveRef(graph, targetRef)
  let targetIRI = iriValue(targetRef)
  const sourceIRI = iriValue(get(targetNode, P.hasSource)) ?? targetIRI
  targetIRI = targetIRI ?? sourceIRI
  if (!targetIRI && !sourceIRI) return null

  const selector = targetNode ? resolveSelector(graph, get(targetNode, P.hasSelector)) : undefined

  const stateRefs = asList(get(targetNode, P.hasState))
  const states = stateRefs.map(ref => resolveState(graph, ref)).filter(Boolean) as State[]

  const renderedViaIRI = iriValue(get(targetNode, P.renderedVia))

  // ID: prefer canonical urn:uuid, else the node IRI fragment.
  const canonicalIRI = iriValue(get(annotationNode, P.canonical)) ?? ''
  const rawId = nodeId(annotationNode)
  const id = canonicalIRI.startsWith('urn:uuid:')
    ? canonicalIRI.slice('urn:uuid:'.length)
    : (rawId?.startsWith('#') ? rawId.slice(1) : (rawId || crypto.randomUUID()))

  const body = parseBody(graph, annotationNode)
  const bodyValue = stringValue(get(annotationNode, P.bodyValue))

  const creatorRef = get(annotationNode, P.creator)
  const creatorNode = resolveRef(graph, creatorRef)
  const creatorIRI = iriValue(creatorRef)
  const creatorName = stringValue(get(creatorNode, P.name))
  const creatorImage = iriValue(get(creatorNode, P.image))

  const datetime = stringValue(get(annotationNode, P.created)) ?? new Date().toISOString()
  const annotationLanguage = stringValue(get(annotationNode, P.language))
  const annotationLicense = iriValue(get(annotationNode, P.license))
  const annotationRights = iriValue(get(annotationNode, P.rights))
  const annotationInbox = iriValue(get(annotationNode, P.inbox))

  return {
    motivatedBy: motivated,
    id,
    canonical: canonicalIRI || `urn:uuid:${id}`,
    ...(annotationLanguage && { language: annotationLanguage }),
    ...(annotationLicense && { license: annotationLicense }),
    ...(annotationRights && { rights: annotationRights }),
    ...(annotationInbox && { inbox: annotationInbox }),
    creator: {
      ...(creatorIRI && { iri: creatorIRI }),
      ...(creatorName && { name: creatorName }),
      ...(creatorImage && { image: creatorImage }),
    },
    datetime,
    target: {
      iri: targetIRI ?? sourceIRI!,
      source: sourceIRI ?? targetIRI!,
      ...(selector && { selector }),
      ...(states.length && { state: states.length === 1 ? states[0] : states }),
      ...(renderedViaIRI && { renderedVia: { iri: renderedViaIRI } }),
    },
    body,
    ...(bodyValue && { bodyValue }),
    // The annotation's own IRI (the unwrapped node's id), not a wrapper's.
    iri: (rawId && rawId !== '') ? rawId : annotationIRI,
  }
}

// Turns raw input into JSON-LD; sync or async.
export type JSONLDParser = (input: unknown) => JSONLDNode | JSONLDNode[] | Promise<JSONLDNode | JSONLDNode[]>

// Runs the required caller-supplied parser (owns fetching/format/context), then maps its JSON-LD via parseStoredAnnotation.
export async function parseAnnotation(
  input: unknown,
  options: { parser: JSONLDParser; annotationIRI?: string }
): Promise<Annotation | null> {
  const parser = options?.parser
  if (typeof parser !== 'function') {
    throw new Error(
      'parseAnnotation: a `parser` is required — pass a function that fetches/parses ' +
      'the input into valid JSON-LD (compact or expanded). If you already have JSON-LD, ' +
      'call parseStoredAnnotation directly.'
    )
  }
  const jsonld = await parser(input)
  return parseStoredAnnotation(jsonld, options.annotationIRI)
}

function toGraph(input: JSONLDNode | JSONLDNode[]): Node[] {
  let nodes: Node[]
  if (Array.isArray(input)) {
    nodes = input as Node[]
  } else if (input && typeof input === 'object') {
    const graph = (input as Node)['@graph']
    nodes = Array.isArray(graph) ? (graph as Node[]) : [input as Node]
  } else {
    return []
  }
  return mergeNodesById(nodes)
}

// Consolidates same-@id objects into one node (unflattened RDF-derived JSON-LD scatters a subject across many); repeated predicates collapse to arrays, anonymous objects pass through.
function mergeNodesById(nodes: Node[]): Node[] {
  const byId = new Map<string, Node>()
  const anonymous: Node[] = []
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue
    const id = nodeId(node)
    if (id === undefined) { anonymous.push(node); continue }
    const existing = byId.get(id)
    if (!existing) { byId.set(id, { ...node }); continue }
    for (const [k, v] of Object.entries(node)) {
      if (k === '@id' || k === 'id' || k === '@context') continue
      existing[k] = existing[k] === undefined ? v : [...asList(existing[k]), ...asList(v)]
    }
  }
  return [...byId.values(), ...anonymous]
}

function asList(value: unknown): unknown[] {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

// Bare WA token to prefixed form (replying becomes oa:replying); keeps IRIs as-is.
function expandMotivation(value: string | undefined): string | undefined {
  if (!value) return undefined
  if (value.includes('://') || value.includes(':')) return value
  return `oa:${value}`
}

function parseBody(graph: Node[], annotationNode: Node): AnnotationBodyObject[] {
  const bodies: AnnotationBodyObject[] = []
  for (const ref of asList(get(annotationNode, P.hasBody))) {
    if (typeof ref === 'string') {
      // A bare string body (not a graph reference) is the value itself.
      if (!graph.find(n => nodeId(n) === ref)) { bodies.push({ value: ref }); continue }
    }
    const bn = resolveRef(graph, ref)
    if (!bn) continue
    const value = stringValue(get(bn, P.rdfValue)) ?? stringValue(get(bn, P.description))
    if (value === undefined) continue
    // Well-known purposes reduce to their short token; a custom purpose IRI is preserved.
    const purposeRaw = get(bn, P.hasPurpose)
    const purpose = purposeRaw !== undefined ? purposeToken(iriValue(purposeRaw) ?? stringValue(purposeRaw)) : undefined
    const language = stringValue(get(bn, P.language))
    const format = stringValue(get(bn, P.format))
    const license = iriValue(get(bn, P.license))
    const rights = iriValue(get(bn, P.rights))
    const bid = fragmentId(bn)
    bodies.push({
      ...(bid && { id: bid }),
      value,
      ...(purpose && { purpose }),
      ...(language && { language }),
      ...(format && { format }),
      ...(license && { license }),
      ...(rights && { rights }),
    })
  }
  return bodies
}

// oa:refinedBy may carry one or several selectors; returns one, an array, or undefined.
function resolveRefinedBy(graph: Node[], raw: unknown): Selector | Selector[] | undefined {
  if (raw === undefined) return undefined
  if (Array.isArray(raw)) {
    const sels = raw.map(r => resolveSelector(graph, r)).filter(Boolean) as Selector[]
    return sels.length === 0 ? undefined : sels.length === 1 ? sels[0] : sels
  }
  return resolveSelector(graph, raw)
}

// Collapses a single-or-array refinement to one selector, for fallback when the parent is unparsable.
function firstSelector(refined: Selector | Selector[] | undefined): Selector | undefined {
  return Array.isArray(refined) ? refined[0] : refined
}

function resolveSelector(graph: Node[], ref: unknown): Selector | undefined {
  const node = resolveRef(graph, ref)
  if (!node) return undefined

  const sid = fragmentId(node)
  const refinedBy = resolveRefinedBy(graph, get(node, P.refinedBy))

  if (isType(node, 'TextQuoteSelector')) {
    const exactRaw = get(node, P.exact)
    const exact = stringValue(exactRaw)
    if (exact === undefined) return firstSelector(refinedBy)
    const language = langValue(exactRaw) ?? langValue(get(node, P.prefix)) ?? langValue(get(node, P.suffix))
    const sel: TextQuoteSelector = {
      type: 'TextQuoteSelector',
      exact,
      prefix: stringValue(get(node, P.prefix)) ?? '',
      suffix: stringValue(get(node, P.suffix)) ?? '',
    }
    if (sid) sel.id = sid
    if (language) sel.language = language
    if (refinedBy) sel.refinedBy = refinedBy
    return sel
  }

  if (isType(node, 'TextPositionSelector')) {
    const sel: TextPositionSelector = {
      type: 'TextPositionSelector',
      start: numberValue(get(node, P.start)),
      end: numberValue(get(node, P.end)),
    }
    if (sid) sel.id = sid
    if (refinedBy) sel.refinedBy = refinedBy
    return sel
  }

  if (isType(node, 'XPathSelector')) {
    const sel: XPathSelector = { type: 'XPathSelector', value: stringValue(get(node, P.rdfValue)) ?? '' }
    if (sid) sel.id = sid
    if (refinedBy) sel.refinedBy = refinedBy
    return sel
  }

  if (isType(node, 'RangeSelector')) {
    const startSelector = resolveSelector(graph, get(node, P.hasStartSelector))
    const endSelector = resolveSelector(graph, get(node, P.hasEndSelector))
    if (!startSelector || !endSelector) return firstSelector(refinedBy)
    const sel: RangeSelector = { type: 'RangeSelector', startSelector, endSelector }
    if (sid) sel.id = sid
    if (refinedBy) sel.refinedBy = refinedBy
    return sel
  }

  if (isType(node, 'FragmentSelector')) {
    const sel: FragmentSelector = {
      type: 'FragmentSelector',
      value: stringValue(get(node, P.rdfValue)) ?? '',
      ...(iriValue(get(node, P.conformsTo)) && { conformsTo: iriValue(get(node, P.conformsTo)) }),
    }
    if (sid) sel.id = sid
    if (refinedBy) sel.refinedBy = refinedBy
    return sel
  }

  // Unknown selector type refining a known one; surface the refinement.
  return firstSelector(refinedBy)
}

// TimeState's refinedBy chains to another state (HttpRequestState); resolve as states, not selectors.
function resolveStateRefinedBy(graph: Node[], raw: unknown): State | State[] | undefined {
  if (raw === undefined) return undefined
  if (Array.isArray(raw)) {
    const sts = raw.map(r => resolveState(graph, r)).filter(Boolean) as State[]
    return sts.length === 0 ? undefined : sts.length === 1 ? sts[0] : sts
  }
  return resolveState(graph, raw)
}

function resolveState(graph: Node[], ref: unknown): State | undefined {
  const node = resolveRef(graph, ref)
  if (!node) return undefined

  const sid = fragmentId(node)

  if (isType(node, 'HttpRequestState')) {
    const raw = get(node, P.rdfValue)
    const values = (Array.isArray(raw) ? raw : [raw]).map(stringValue).filter(Boolean) as string[]
    const state: HttpRequestState = {
      type: 'HttpRequestState',
      value: values.length <= 1 ? (values[0] ?? '') : values,
    }
    if (sid) state.id = sid
    const refinedBy = resolveRefinedBy(graph, get(node, P.refinedBy))
    if (refinedBy) state.refinedBy = refinedBy
    return state
  }

  if (isType(node, 'TimeState')) {
    const state: TimeState = { type: 'TimeState' }
    if (sid) state.id = sid
    const sourceDate = stringValue(get(node, P.sourceDate))
    const sourceDateStart = stringValue(get(node, P.sourceDateStart))
    const sourceDateEnd = stringValue(get(node, P.sourceDateEnd))
    const cached = iriValue(get(node, P.cached))
    if (sourceDate) state.sourceDate = sourceDate
    if (sourceDateStart) state.sourceDateStart = sourceDateStart
    if (sourceDateEnd) state.sourceDateEnd = sourceDateEnd
    if (cached) state.cached = cached
    const refinedBy = resolveStateRefinedBy(graph, get(node, P.refinedBy))
    if (refinedBy) state.refinedBy = refinedBy
    return state
  }

  return undefined
}
