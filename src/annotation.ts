import type {
  Annotation,
  AnnotationBodyObject,
  CreateAnnotationParams,
  Selector,
  State,
} from './types.js'
import { generateId } from './id.js'

// Comma-separated tags to body objects, sorted and deduplicated.
export function tagsToBodyObjects(
  string: string,
  purpose: 'tagging' | 'classifying' = 'tagging'
): Array<{ purpose: 'tagging' | 'classifying'; value: string }> {
  if (!string) return []

  const seen = new Set<string>()
  return string
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length)
    .sort()
    .filter(tag => {
      if (seen.has(tag)) return false
      seen.add(tag)
      return true
    })
    .map(tag => ({ purpose, value: tag }))
}

// https://www.w3.org/TR/annotation-model/#cardinality-of-bodies-and-targets mentions some annotations may not have a body at all, such as the ones listed here.
const BODYLESS_MOTIVATIONS = new Set(['oa:bookmarking', 'oa:highlighting'])

function normalizeRefinedBy(refinedBy: Selector | Selector[]): Selector | Selector[] {
  return Array.isArray(refinedBy) ? refinedBy.map(r => normalizeSelector(r)!) : normalizeSelector(refinedBy)!
}

// Fills TextQuoteSelector defaults; ensures every node (nested and refinedBy) has a random id.
function normalizeSelector(selector?: Selector): Selector | undefined {
  if (!selector) return undefined
  const id = selector.id ?? generateId()

  if (selector.type === 'TextQuoteSelector') {
    return {
      type: 'TextQuoteSelector',
      id,
      exact: selector.exact,
      prefix: selector.prefix ?? '',
      suffix: selector.suffix ?? '',
      language: selector.language ?? '',
      ...(selector.refinedBy && { refinedBy: normalizeRefinedBy(selector.refinedBy) }),
    }
  }

  if (selector.type === 'RangeSelector') {
    return {
      ...selector,
      id,
      startSelector: normalizeSelector(selector.startSelector)!,
      endSelector: normalizeSelector(selector.endSelector)!,
      ...(selector.refinedBy && { refinedBy: normalizeRefinedBy(selector.refinedBy) }),
    }
  }

  return {
    ...selector,
    id,
    ...(selector.refinedBy && { refinedBy: normalizeRefinedBy(selector.refinedBy) }),
  }
}

function normalizeState(state?: State | State[]): State | State[] | undefined {
  if (!state) return undefined
  return Array.isArray(state) ? state.map(normalizeOneState) : normalizeOneState(state)
}

// Adds id and recurses: TimeState.refinedBy is state(s), HttpRequestState.refinedBy is selector(s).
function normalizeOneState(state: State): State {
  const id = state.id ?? generateId()
  if (state.type === 'TimeState') {
    return {
      ...state,
      id,
      ...(state.refinedBy && {
        refinedBy: Array.isArray(state.refinedBy)
          ? state.refinedBy.map(normalizeOneState)
          : normalizeOneState(state.refinedBy),
      }),
    }
  }
  return {
    ...state,
    id,
    ...(state.refinedBy && { refinedBy: normalizeRefinedBy(state.refinedBy) }),
  }
}

// Pure builder for a W3C Web Annotation.
// Takes a motivation IRI (or prefixed motivation). Takes only one target (TODO multiple targets).
export function createAnnotation({
  motivatedBy,
  id,
  iri,
  canonical,
  datetime,
  language,
  license,
  rights,
  target,
  body,
  creator = {},
}: CreateAnnotationParams): Annotation {
  if (!motivatedBy) throw new Error('createAnnotation: motivatedBy is required')
  if (!target) throw new Error('createAnnotation: target is required')

  const bodyless = BODYLESS_MOTIVATIONS.has(motivatedBy)

  const resolvedId = id ?? crypto.randomUUID()
  const resolvedDatetime = datetime ?? new Date().toISOString()

  const annotation: Annotation = {
    motivatedBy,
    id: resolvedId,
    canonical: canonical ?? ('urn:uuid:' + resolvedId),
    ...(iri !== undefined && { iri }),
    creator: {},
    datetime: resolvedDatetime,
    ...(language && { language }),
    ...(license && { license }),
    ...(rights && { rights }),
    target: {
      iri: target.iri,
      source: target.source,
      language: target.language,
      ...(target.rel && { rel: target.rel }),
      ...(target.selector && { selector: normalizeSelector(target.selector) }),
      ...(target.state && { state: normalizeState(target.state) }),
      ...(target.renderedVia && { renderedVia: target.renderedVia }),
    },
    body: [],
  }

  // Build a body object unless motivation is bodyless and none was supplied.
  if (body?.content !== undefined || body?.purpose || !bodyless) {
    const bodyObject: AnnotationBodyObject = { value: body?.content ?? '', format: body?.format ?? 'text/html' }
    if (body?.purpose) bodyObject.purpose = body.purpose
    else if (motivatedBy === 'oa:bookmarking') bodyObject.purpose = 'describing'
    // Body-level metadata is independent of the annotation-level fields above; the serializer
    // treats the annotation-level values as the default a body inherits unless it sets its own.
    if (body?.language) bodyObject.language = body.language
    if (body?.rights)   bodyObject.rights = body.rights
    if (body?.license)  bodyObject.license = body.license
    annotation.body = [bodyObject, ...tagsToBodyObjects(body?.tags ?? '')]
  } else if (body?.tags) {
    annotation.body = tagsToBodyObjects(body.tags)
  }

  // Every body node carries a random (UUID) id.
  annotation.body = annotation.body.map(b => ({ id: generateId(), ...b }))

  if (creator.iri)   annotation.creator.iri   = creator.iri
  if (creator.name)  annotation.creator.name  = creator.name
  if (creator.image) annotation.creator.image = creator.image
  if (creator.url)   annotation.creator.url   = creator.url
  if (creator.type)  annotation.creator.type  = creator.type

  return annotation
}
