import type { Annotation, AnnotationBodyObject, AnnotationLabels, SerializeOptions, Selector, State, TimeState, HttpRequestState } from './types.js'
import { generateId } from './id.js'
import { purposeToken } from './purpose.js'
import { serializeAnnotationToJSONLD, type JSONLDOptions } from './jsonld.js'

export type SerializeFormat = 'rdfa' | 'html' | 'jsonld'

// Defaults to the conformant W3C JSON-LD object; 'rdfa'/'html' return an HTML+RDFa string.
export function serializeAnnotation(
  annotation: Annotation,
  options: (SerializeOptions & JSONLDOptions & { format?: SerializeFormat }) = {}
): string | Record<string, unknown> {
  const { format = 'jsonld', ...rest } = options
  if (format === 'rdfa' || format === 'html') return serializeAnnotationToHTML(annotation, rest)
  return serializeAnnotationToJSONLD(annotation, rest)
}

const IRI_TO_PREFIX: Record<string, string> = {
  'http://www.w3.org/ns/oa#':                     'oa',
  'https://www.w3.org/ns/activitystreams#':       'as',
  'http://www.w3.org/1999/02/22-rdf-syntax-ns#':  'rdf',
  'http://purl.org/dc/terms/':                    'dcterms',
  'http://purl.org/dc/elements/1.1/':             'dc',
  'http://schema.org/':                           'schema',
  'http://www.w3.org/ns/ldp#':                    'ldp',
  'http://xmlns.com/foaf/0.1/':                   'foaf',
}

function getPrefixedName(iri: string | undefined): string | undefined {
  if (!iri) return iri
  for (const [ns, prefix] of Object.entries(IRI_TO_PREFIX)) {
    if (iri.startsWith(ns)) return `${prefix}:${iri.slice(ns.length)}`
  }
  return iri
}

function formatMeta(format: string | undefined): string {
  return format ? `<dl class="format"><dt>Format</dt><dd lang="" property="http://purl.org/dc/elements/1.1/format" xml:lang="" datatype="xsd:string">${format}</dd></dl>` : ''
}

// Escapes &, <, > for text-mode HTML.
function htmlEncode(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// DOM-safe ID slug from a string (e.g. a tag value).
function slugId(string: unknown): string {
  const slug = String(string ?? '')
    .trim()
    .replace(/\W/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  const id = slug || crypto.randomUUID().split('-')[0]
  return /^\d/.test(id) ? `x-${id}` : id
}

interface MotivationMeta {
  label: string
  targetLabel: string
  bodyAltLabel: string
  /** `<article>` carries the full RDFa prefix attribute */
  usesPrefix: boolean
}

// One entry per well-known WA motivation (the same vocabulary as WellKnownPurpose). Every label is
// an English default overridable per motivation via SerializeOptions.motivationLabels (for i18n).
const MOTIVATION_META: Record<string, MotivationMeta> = {
  'oa:assessing':    { label: 'assesses',   targetLabel: 'Assessment of',     bodyAltLabel: 'Assessed',    usesPrefix: true  },
  'oa:bookmarking':  { label: 'bookmarks',  targetLabel: 'Bookmarked',        bodyAltLabel: 'Bookmarked',  usesPrefix: true  },
  'oa:classifying':  { label: 'classifies', targetLabel: 'Classification of', bodyAltLabel: 'Classified',  usesPrefix: true  },
  'oa:commenting':   { label: 'comments',   targetLabel: 'Comments on',       bodyAltLabel: 'Commented',   usesPrefix: false },
  'oa:describing':   { label: 'describes',  targetLabel: 'Describes',         bodyAltLabel: 'Described',   usesPrefix: false },
  'oa:editing':      { label: 'edits',      targetLabel: 'Edit of',           bodyAltLabel: 'Edited',      usesPrefix: true  },
  'oa:highlighting': { label: 'highlights', targetLabel: 'Highlight in',      bodyAltLabel: 'Highlighted', usesPrefix: true  },
  'oa:identifying':  { label: 'identifies', targetLabel: 'Identifies',        bodyAltLabel: 'Identified',  usesPrefix: true  },
  'oa:linking':      { label: 'links',      targetLabel: 'Links to',          bodyAltLabel: 'Linked',      usesPrefix: true  },
  'oa:moderating':   { label: 'moderates',  targetLabel: 'Moderates',         bodyAltLabel: 'Moderated',   usesPrefix: true  },
  'oa:questioning':  { label: 'questions',  targetLabel: 'Questions',         bodyAltLabel: 'Questioned',  usesPrefix: true  },
  'oa:replying':     { label: 'replies',    targetLabel: 'In reply to',       bodyAltLabel: 'Replied',     usesPrefix: true  },
  'oa:tagging':      { label: 'tags',       targetLabel: 'Tags',              bodyAltLabel: 'Tagged',      usesPrefix: true  },
}

const DEFAULT_MOTIVATION_META = MOTIVATION_META['oa:replying']

const DEFAULT_LABELS: AnnotationLabels = {
  authors: 'Authors',
  created: 'Created',
  language: 'Language',
  license: 'License',
  rights: 'Rights',
  inbox: 'Notifications Inbox',
  canonical: 'Canonical',
  tags: 'Tags',
  classifications: 'Classifications',
  note: 'Note',
  renderedVia: 'Rendered via',
  partOf: 'part of',
  selector: 'Selector',
  refinedBy: 'Refined by',
  startSelector: 'Start selector',
  endSelector: 'End selector',
  fragmentConformsTo: 'Fragment selector conforms to',
  rfc3987: 'RFC 3987',
  sourceDate: 'Source date',
  sourceDateStart: 'Source date start',
  sourceDateEnd: 'Source date end',
  cached: 'Cached source',
  httpRequest: 'HTTP request',
}

function resolveLabels(labels?: Partial<AnnotationLabels>): AnnotationLabels {
  return labels ? { ...DEFAULT_LABELS, ...labels } : DEFAULT_LABELS
}

const RDF_PREFIXES_ATTR = 'prefix="rdf: http://www.w3.org/1999/02/22-rdf-syntax-ns# schema: http://schema.org/ dcterms: http://purl.org/dc/terms/ dc: http://purl.org/dc/elements/1.1/ oa: http://www.w3.org/ns/oa# as: https://www.w3.org/ns/activitystreams# ldp: http://www.w3.org/ns/ldp# foaf: http://xmlns.com/foaf/0.1/"'

function createLanguageHTML(
  language: string | undefined,
  { property = 'dcterms:language', label = 'Language', name }: { property?: string; label?: string; name?: string } = {}
): string {
  if (!language) return ''
  // RDFa literal value is always the language code; if caller supplies a display name it goes in the text node with the code in @content. Name resolution is the caller's concern (generic Intl.DisplayNames gives wrong/non-canonical strings).
  const content = name ? ` content="${language}"` : ''
  const text = name ?? language
  return `<dl class="language"><dt>${label}</dt><dd><span${content} lang="" property="${property}" xml:lang="" datatype="xsd:string">${text}</span></dd></dl>`
}

function createLicenseRightsHTML(
  iri: string | undefined,
  {
    rel = 'dcterms:license',
    label = 'License',
    licenses = {},
  }: { rel?: string; label?: string; licenses?: Record<string, { name: string }> } = {}
): string {
  if (!iri) return ''
  const name = licenses[iri]?.name ?? iri
  const cssClass = label.toLowerCase().replace(/\s+/g, '-')
  return `<dl class="${cssClass}"><dt>${label}</dt><dd><a href="${iri}" rel="${rel}">${name}</a></dd></dl>`
}

const RFC3987 = 'https://tools.ietf.org/html/rfc3987'

// Renders any selector to RDFa. `rel` is the relation from the parent (oa:hasSelector at top level; oa:refinedBy/hasStartSelector/hasEndSelector nested).
function selectorToHTML(
  selector: Selector,
  { rel, language = '', labels }: { rel: string; language?: string; labels: AnnotationLabels }
): string {
  const resource = `#${selector.id ?? generateId()}`
  const dtLabel = rel === 'oa:refinedBy' ? labels.refinedBy
    : rel === 'oa:hasStartSelector' ? labels.startSelector
    : rel === 'oa:hasEndSelector' ? labels.endSelector
    : labels.selector

  const refinements = selector.refinedBy
    ? (Array.isArray(selector.refinedBy) ? selector.refinedBy : [selector.refinedBy])
    : []
  const refinedBy = refinements
    .map(r => selectorToHTML(r, { rel: 'oa:refinedBy', language, labels }))
    .join('')

  switch (selector.type) {
    case 'TextQuoteSelector': {
      // Language belongs to the quoted text: set it once on the <dd> so oa:prefix/exact/suffix
      // inherit it, never on the marks. Omit when unknown to avoid an empty langString.
      const lang = selector.language || language
      const langAttr = lang ? ` lang="${lang}" xml:lang="${lang}"` : ''
      const { exact = '', prefix = '', suffix = '' } = selector
      return [
        `<dl rel="${rel}" resource="${resource}" typeof="oa:TextQuoteSelector">`,
        `<dt>${dtLabel}</dt>`,
        `<dd${langAttr}>`,
        `<span property="oa:prefix">${prefix}</span>`,
        `<mark property="oa:exact">${exact}</mark>`,
        `<span property="oa:suffix">${suffix}</span>`,
        `</dd>`,
        refinedBy ? `<dd>${refinedBy}</dd>` : '',
        `</dl>`
      ].join('')
    }

    case 'TextPositionSelector':
      return [
        `<dl rel="${rel}" resource="${resource}" typeof="oa:TextPositionSelector">`,
        `<dt>${dtLabel}</dt>`,
        `<dd><span datatype="xsd:nonNegativeInteger" property="oa:start">${selector.start}</span>–<span datatype="xsd:nonNegativeInteger" property="oa:end">${selector.end}</span></dd>`,
        refinedBy ? `<dd>${refinedBy}</dd>` : '',
        `</dl>`,
      ].join('')

    case 'FragmentSelector': {
      const conformsTo = selector.conformsTo ?? RFC3987
      const conformsLabel = conformsTo === RFC3987 ? labels.rfc3987 : conformsTo
      return [
        `<div rel="${rel}" resource="${resource}" typeof="oa:FragmentSelector">`,
        `<dl class="conformsto">`,
        `<dt>${labels.fragmentConformsTo}</dt>`,
        `<dd><a content="${htmlEncode(selector.value)}" lang="" property="rdf:value" rel="dcterms:conformsTo" href="${conformsTo}" xml:lang="" datatype="xsd:string">${conformsLabel}</a></dd>`,
        `</dl>`,
        refinedBy,
        `</div>`,
      ].join('')
    }

    case 'XPathSelector':
      return [
        `<div rel="${rel}" resource="${resource}" typeof="oa:XPathSelector">`,
        `<dl>`,
        `<dt>${dtLabel}</dt>`,
        `<dd><code property="rdf:value">${htmlEncode(selector.value)}</code></dd>`,
        `</dl>`,
        refinedBy,
        `</div>`,
      ].join('')

    case 'RangeSelector':
      return [
        `<div rel="${rel}" resource="${resource}" typeof="oa:RangeSelector">`,
        selectorToHTML(selector.startSelector, { rel: 'oa:hasStartSelector', language, labels }),
        selectorToHTML(selector.endSelector, { rel: 'oa:hasEndSelector', language, labels }),
        refinedBy,
        `</div>`,
      ].join('')

    default:
      return ''
  }
}

// Renders the target's selector as RDFa, faithful to the typed selector (no FragmentSelector wrapping).
function targetSelectorToHTML(selector: Selector, language: string, labels: AnnotationLabels): string {
  return selectorToHTML(selector, { rel: 'oa:hasSelector', language, labels })
}

// A state's refinedBy may chain to another state or down to selectors.
function stateRefinedByHTML(state: State, labels: AnnotationLabels): string {
  if (!state.refinedBy) return ''
  const refs = Array.isArray(state.refinedBy) ? state.refinedBy : [state.refinedBy]
  return refs
    .map(r =>
      r.type === 'TimeState' || r.type === 'HttpRequestState'
        ? stateToHTML(r, 'oa:refinedBy', labels)
        : selectorToHTML(r, { rel: 'oa:refinedBy', labels })
    )
    .join('')
}

function timeStateToHTML(state: TimeState, rel: string, labels: AnnotationLabels): string {
  const resource = `#${state.id ?? generateId()}`
  const rows: string[] = []
  const timeRow = (label: string, prop: string, value?: string): string =>
    value
      ? `<dl><dt>${label}</dt><dd><time datetime="${value}" datatype="xsd:dateTime" property="${prop}" content="${value}">${value.slice(0, 19).replace('T', ' ')}</time></dd></dl>`
      : ''
  rows.push(timeRow(labels.sourceDate, 'oa:sourceDate', state.sourceDate))
  rows.push(timeRow(labels.sourceDateStart, 'oa:sourceDateStart', state.sourceDateStart))
  rows.push(timeRow(labels.sourceDateEnd, 'oa:sourceDateEnd', state.sourceDateEnd))
  if (state.cached) {
    rows.push(`<dl><dt>${labels.cached}</dt><dd><a href="${state.cached}" rel="oa:cachedSource">${state.cached}</a></dd></dl>`)
  }
  return `<div rel="${rel}" resource="${resource}" typeof="oa:TimeState">${rows.join('')}${stateRefinedByHTML(state, labels)}</div>`
}

function httpRequestStateToHTML(state: HttpRequestState, rel: string, labels: AnnotationLabels): string {
  const resource = `#${state.id ?? generateId()}`
  const values = Array.isArray(state.value) ? state.value : [state.value]
  const rows = values
    .map(v => `<dl><dt>${labels.httpRequest}</dt><dd><span property="rdf:value">${htmlEncode(v)}</span></dd></dl>`)
    .join('')
  return `<div rel="${rel}" resource="${resource}" typeof="oa:HttpRequestState">${rows}${stateRefinedByHTML(state, labels)}</div>`
}

function stateToHTML(state: State, rel: string, labels: AnnotationLabels): string {
  return state.type === 'HttpRequestState'
    ? httpRequestStateToHTML(state, rel, labels)
    : timeStateToHTML(state, rel, labels)
}

function statesToHTML(state: State | State[] | undefined, labels: AnnotationLabels): string {
  if (!state) return ''
  const states = Array.isArray(state) ? state : [state]
  return states.map(s => stateToHTML(s, 'oa:hasState', labels)).join('')
}

// Serializes an annotation to an RDFa-annotated HTML string.
export function serializeAnnotationToHTML(annotation: Annotation, options: SerializeOptions = {}): string {
  const {
    headingLevel = 1,
    about,
    licenses = {},
    resolveImage,
    resolveName,
    resolveLanguageName,
  } = options
  const L = resolveLabels(options.labels)

  const {
    id,
    canonical,
    motivatedBy = '',
    creator = {},
    datetime,
    language: annotationLanguage,
    license: annotationLicense,
    rights: annotationRights,
    inbox,
    iri: annotationIRI,
    target,
    body,
    bodyValue,
  } = annotation

  // -- Motivation --
  const prefixedMotivation = getPrefixedName(motivatedBy) || 'oa:replying'
  const baseMeta = MOTIVATION_META[prefixedMotivation] ?? DEFAULT_MOTIVATION_META
  const meta = { ...baseMeta, ...options.motivationLabels?.[prefixedMotivation] }

  // -- RDFa about + prefix -- subject defaults to stored annotation IRI, else a local fragment; `about` overrides.
  const aAbout = about ?? annotationIRI ?? `#${id}`
  const aPrefix = meta.usesPrefix ? ` ${RDF_PREFIXES_ATTR}` : ''

  const hX = headingLevel

  // -- Creator --
  let creatorHTML = ''
  let creatorName = creator.iri ?? ''
  let authorsHTML = ''

  if (creator.iri || creator.name) {
    const creatorIRI = creator.iri ?? `#${slugId(creator.name ?? '')}`
    const resolvedName = resolveName?.(creator)
    creatorName = resolvedName ?? creator.name ?? creatorIRI

    const nameSpan = `<span about="${creatorIRI}" property="foaf:name" datatype="xsd:string">${creatorName}</span>`
    const nameLinked = creator.url
      ? `<a href="${creator.url}" rel="foaf:homepage">${nameSpan}</a>`
      : `<a href="${creatorIRI}">${nameSpan}</a>`

    // The creator image is annotation data (schema:image). No image -> no avatar; a display-only placeholder for anonymous creators is the consumer's concern.
    const image = resolveImage?.(creator) ?? creator.image
    const avatarHTML = image
      ? `<img alt="" height="48" rel="schema:image" src="${image}" width="48" /> `
      : ''

    // Emit the profile's declared type(s) verbatim; nothing when there are none.
    const creatorTypes = creator.type ? (Array.isArray(creator.type) ? creator.type : [creator.type]) : []
    const typeofAttr = creatorTypes.length ? ` typeof="${creatorTypes.map(getPrefixedName).join(' ')}"` : ''
    creatorHTML = `<span about="${creatorIRI}"${typeofAttr}>${avatarHTML}${nameLinked}</span>`
    authorsHTML = `<dl class="author-name"><dt>${L.authors}</dt><dd><span rel="dcterms:creator">${creatorHTML}</span></dd></dl>`
  }

  const heading = `<h${hX}>${creatorName} <span rel="oa:motivatedBy" resource="${prefixedMotivation}">${meta.label}</span></h${hX}>`

  // -- Inbox --
  const inboxHTML = inbox
    ? `<dl class="inbox"><dt>${L.inbox}</dt><dd><a href="${inbox}" rel="ldp:inbox">${inbox}</a></dd></dl>`
    : ''

  // -- Datetime --
  let createdHTML = ''
  if (datetime) {
    const timeEl = `<time datetime="${datetime}" datatype="xsd:dateTime" property="dcterms:created" content="${datetime}">${datetime.slice(0, 19).replace('T', ' ')}</time>`
    const timeLinked = annotationIRI ? `<a href="${annotationIRI}">${timeEl}</a>` : timeEl
    createdHTML = `<dl class="created"><dt>${L.created}</dt><dd>${timeLinked}</dd></dl>`
  }

  // -- Language / License / Rights --
  const lang    = annotationLanguage ? ` lang="${annotationLanguage}"` : ''
  const xmlLang = annotationLanguage ? ` xml:lang="${annotationLanguage}"` : ''
  const languageHTML = createLanguageHTML(annotationLanguage, { property: 'dcterms:language', label: L.language, name: annotationLanguage ? resolveLanguageName?.(annotationLanguage) : undefined })
  const licenseHTML  = createLicenseRightsHTML(annotationLicense, { rel: 'dcterms:license',   label: L.license, licenses })
  const rightsHTML   = createLicenseRightsHTML(annotationRights,  { rel: 'dcterms:rights',   label: L.rights,  licenses })

  // -- Body --
  let bodyHTML = ''
  if (Array.isArray(body)) {
    const tagBodies: AnnotationBodyObject[] = []
    const classifyBodies: AnnotationBodyObject[] = []

    body.forEach(bodyItem => {
      const bodyLanguage = createLanguageHTML(bodyItem.language, { property: 'dcterms:language', label: L.language, name: bodyItem.language ? resolveLanguageName?.(bodyItem.language) : undefined }) || languageHTML
      const bodyLicense  = createLicenseRightsHTML(bodyItem.license, { rel: 'dcterms:license', label: L.license, licenses }) || licenseHTML
      const bodyRights   = createLicenseRightsHTML(bodyItem.rights,  { rel: 'dcterms:rights', label: L.rights,  licenses }) || rightsHTML
      const bodyVal      = bodyItem.value || meta.bodyAltLabel
      const bodyId       = bodyItem.id ?? generateId()

      // Well-known purposes (short token, oa: prefixed, or full IRI) render specially; any other purpose is a caller-supplied IRI, emitted verbatim as oa:hasPurpose.
      const purpose = purposeToken(bodyItem.purpose)
      if (purpose === 'describing') {
        bodyHTML += `
        <section id="${bodyId}" rel="oa:hasBody" resource="#${bodyId}" typeof="oa:TextualBody">
          <h${hX + 1} rel="oa:hasPurpose" resource="oa:describing">${L.note}</h${hX + 1}>
          ${bodyLanguage}
          ${bodyLicense}
          ${bodyRights}
          ${formatMeta(bodyItem.format)}
          <div${lang} datatype="rdf:HTML" property="rdf:value"${xmlLang}>${bodyVal}</div>
        </section>`
      } else if (purpose === 'tagging') {
        tagBodies.push(bodyItem)
      } else if (purpose === 'classifying') {
        classifyBodies.push(bodyItem)
      } else {
        const purposeAttr = purpose ? ` rel="oa:hasPurpose" resource="${purpose}"` : ''
        bodyHTML += `
          <section id="${bodyId}" rel="oa:hasBody" resource="#${bodyId}" typeof="oa:TextualBody">
            <h${hX + 1}${purposeAttr}>${L.note}</h${hX + 1}>
            ${bodyLanguage}
            ${bodyLicense}
            ${bodyRights}
            ${formatMeta(bodyItem.format)}
            <div${lang} datatype="rdf:HTML" property="rdf:value"${xmlLang}>${bodyVal}</div>
          </section>`
      }
    })

    // Dedupe by value (keeping the first body's id), then sort by value.
    const uniqueBodies = (items: AnnotationBodyObject[]): AnnotationBodyObject[] => {
      const seen = new Set<string>()
      return items
        .filter(b => (seen.has(b.value) ? false : seen.add(b.value)))
        .sort((a, b) => (a.value > b.value ? 1 : a.value < b.value ? -1 : 0))
    }

    if (tagBodies.length) {
      const tagItems = uniqueBodies(tagBodies)
        .map(b => `<li about="#${b.id ?? generateId()}" typeof="oa:TextualBody" property="rdf:value" rel="oa:hasPurpose" resource="oa:tagging">${htmlEncode(b.value)}</li>`)
        .join('')
      bodyHTML += `<dl class="tags"><dt>${L.tags}</dt><dd><ul rel="oa:hasBody">${tagItems}</ul></dd></dl>`
    }

    if (classifyBodies.length) {
      const classItems = uniqueBodies(classifyBodies)
        .map(b => {
          // A classifying body value may be an IRI (link to a concept) or plain text.
          const isIRI = /^(https?:|urn:|[a-z][\w.-]*:)/i.test(b.value)
          const inner = isIRI
            ? `<a href="${b.value}" property="rdf:value" rel="oa:hasPurpose" resource="oa:classifying">${htmlEncode(b.value)}</a>`
            : `<span property="rdf:value" rel="oa:hasPurpose" resource="oa:classifying">${htmlEncode(b.value)}</span>`
          return `<li about="#${b.id ?? generateId()}" typeof="oa:TextualBody">${inner}</li>`
        })
        .join('')
      bodyHTML += `<dl class="classifications"><dt>${L.classifications}</dt><dd><ul rel="oa:hasBody">${classItems}</ul></dd></dl>`
    }
  } else if (bodyValue) {
    bodyHTML = `<p property="oa:bodyValue">${bodyValue}</p>`
  }

  // -- Target --
  let targetHTML = ''
  let hasTargetHTML = ''
  let annotationTextSelector = ''

  const targetIRI = target?.iri ?? ''
  const targetRelation = target?.rel ?? 'oa:hasTarget'

  if (targetIRI) {
    hasTargetHTML = `<a href="${targetIRI}" rel="${targetRelation}">${meta.targetLabel}</a>`

    if (target?.source) {
      hasTargetHTML += ` (<a about="${target.iri}" href="${target.source}" rel="oa:hasSource" typeof="oa:SpecificResource">${L.partOf}</a>)`
    }

    if (target?.selector) {
      annotationTextSelector = targetSelectorToHTML(target.selector, target.language ?? '', L)
    }

    const stateHTML = statesToHTML(target?.state, L)

    const targetLang = createLanguageHTML(target?.language, { property: 'dcterms:language', label: L.language, name: target?.language ? resolveLanguageName?.(target.language) : undefined })

    targetHTML = `<dl class="target"><dt>${hasTargetHTML}</dt>`
    if (target?.selector || stateHTML) {
      targetHTML += `<dd><blockquote about="${targetIRI}" cite="${targetIRI}">${targetLang}${annotationTextSelector}${stateHTML}</blockquote></dd>`
    }
    targetHTML += `</dl>`
    if (target?.renderedVia?.iri) {
      targetHTML += `<dl class="renderedvia"><dt>${L.renderedVia}</dt><dd><a about="${targetIRI}" href="${target.renderedVia.iri}" rel="oa:renderedVia">${target.renderedVia.name ?? target.renderedVia.iri}</a></dd></dl>`
    }
  }

  // -- Canonical --
  const canonicalId = canonical ?? `urn:uuid:${id}`
  const canonicalHTML = `<dl class="canonical"><dt>${L.canonical}</dt><dd rel="oa:canonical" resource="${canonicalId}">${canonicalId}</dd></dl>`

  return [
    `<article about="${aAbout}" id="${id}" typeof="oa:Annotation"${aPrefix}>`,
    heading,
    authorsHTML,
    createdHTML,
    languageHTML,
    licenseHTML,
    rightsHTML,
    inboxHTML,
    canonicalHTML,
    targetHTML,
    bodyHTML,
    `</article>`,
  ].join('\n')
}

