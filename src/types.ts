export interface TextQuoteSelector {
  type: 'TextQuoteSelector'
  id?: string
  /** The selected text */
  exact: string
  /** Up to N characters immediately before the selection */
  prefix?: string
  /** Up to N characters immediately after the selection */
  suffix?: string
  language?: string
  refinedBy?: Selector | Selector[]
}

export interface TextPositionSelector {
  type: 'TextPositionSelector'
  id?: string
  start: number
  end: number
  refinedBy?: Selector | Selector[]
}

export interface FragmentSelector {
  type: 'FragmentSelector'
  id?: string
  /** e.g. element id, `char=10,20`, `xywh=10,20,30,40` */
  value: string
  /** defaults to RFC 3987 when rendered */
  conformsTo?: string
  refinedBy?: Selector | Selector[]
}

export interface XPathSelector {
  type: 'XPathSelector'
  id?: string
  /** an XPath e.g., `/html[1]/body[1]/article[1]/p[1]` */
  value: string
  refinedBy?: Selector | Selector[]
}

export interface RangeSelector {
  type: 'RangeSelector'
  id?: string
  /** e.g., an XPath */
  startSelector: Selector
  /** e.g., an XPath */
  endSelector: Selector
  refinedBy?: Selector | Selector[]
}

/** A W3C Web Annotation selector, modelled as a discriminated union on `type`. */
export type Selector =
  | TextQuoteSelector
  | FragmentSelector
  | TextPositionSelector
  | XPathSelector
  | RangeSelector

/** W3C `oa:TimeState`: a moment (sourceDate) or interval (sourceDateStart/End). */
export interface TimeState {
  type: 'TimeState'
  id?: string
  /** A timestamp in xsd:dateTime format. */
  sourceDate?: string
  /** A timestamp in xsd:dateTime format. */
  sourceDateStart?: string
  /** A timestamp in xsd:dateTime format. */
  sourceDateEnd?: string
  /** IRI of a memento/cached copy */
  cached?: string
  refinedBy?: State | State[]
}

/** W3C `oa:HttpRequestState`: HTTP request header(s) used to retrieve the selected representation. */
export interface HttpRequestState {
  type: 'HttpRequestState'
  id?: string
  /** e.g. `Accept: text/html` */
  value: string | string[]
  refinedBy?: Selector | Selector[]
}

export type State = TimeState | HttpRequestState

export interface AnnotationCreator {
  /** An IRI that identifiers the creator of the annotation (e.g. `https://alice.example/#me`) */
  iri?: string
  /** Display name */
  name?: string
  /** Avatar URL or data URI */
  image?: string
  /** Profile URL (if different from IRI) */
  url?: string
  /** Agent type IRI(s) from the profile; omitted when absent */
  type?: string | string[]
}

/** Well-known WA purposes the library renders specially (Note / tags / classifications). Accepted as a short token (`tagging`), a prefixed name (`oa:tagging`), or the full oa IRI. */
export type WellKnownPurpose = 'assessing' | 'bookmarking' | 'classifying' | 'commenting' | 'describing' | 'editing' | 'highlighting' | 'identifying' | 'linking' | 'moderating' | 'questioning' | 'replying' | 'tagging'

/** A body purpose: a well-known purpose (above), or any other purpose as a full IRI. Bare short tokens are only recognized for the well-known set; a custom purpose must be an IRI. The `(string & {})` keeps literal autocomplete while still accepting any string. */
export type Purpose = WellKnownPurpose | (string & {})

export interface AnnotationBodyObject {
  id?: string
  value: string
  /** see Purpose below */
  purpose?: Purpose
  /** e.g., `en-GB` */
  language?: string
  /** e.g., https://creativecommons.org/licenses/by/4.0/ */
  license?: string
  /** e.g., https://creativecommons.org/licenses/by/4.0/ */
  rights?: string
  /** media type of the value, e.g. `text/html` (emitted as dc:format) */
  format?: string
}

export interface AnnotationTarget {
  /** IRI of the targeted section (with fragment) */
  iri: string
  /** IRI of the source document (without fragment) */
  source: string
  /** Any selector (see Selectors above) */
  selector?: Selector
  /** Optional time/HTTP-request state(s) */
  state?: State | State[]
  /** Language of the target resource */
  language?: string
  /** RDFa relation for the rendered target link (defaults to `oa:hasTarget`; e.g. `as:inReplyTo` for replies) */
  rel?: string
  /** Tool that rendered the target at annotation time; name is display-only */
  renderedVia?: { iri: string; name?: string }
}

export interface Annotation {
  /** A W3C Web Annotation motivation, e.g. `oa:replying`, or another https://www.w3.org/TR/annotation-vocab/#extending-motivations */
  motivatedBy: string
  /** UUID */
  id: string
  /** stable identifier; `urn:uuid:<id>` fallback unless the client supplies one */
  canonical: string
  creator: Partial<AnnotationCreator>
  /** A timestamp in xsd:dateTime format. */
  datetime: string
  target: AnnotationTarget
  /** embedded TextualBody objects (value + optional format/language/purpose) */
  body: AnnotationBodyObject[]
  /** e.g., a language tag from BCP-47 */
  language?: string
  /** e.g., https://creativecommons.org/licenses/by/4.0/ */
  license?: string
  /** e.g., https://creativecommons.org/licenses/by/4.0/ */
  rights?: string
  /** Annotation's own notifications inbox IRI (caller-assigned; serialized as `ldp:inbox`) */
  inbox?: string
  /** Set after posting; default RDFa subject and datetime link target */
  iri?: string
  /** Simple plain-text embedded body (`oa:bodyValue`; alternative to body array) */
  bodyValue?: string
}

export interface CreateAnnotationParams {
  /** Required. Motivation IRI, e.g. `oa:replying`, `oa:highlighting`, `as:Like` */
  motivatedBy: string
  /** UUID - generated via crypto.randomUUID() if omitted */
  id?: string
  /** Subject IRI used verbatim by both serializers (e.g. `''` for write-then-POST, or a `base#fragment`) */
  iri?: string
  /** Optional stable identifier; emitted as `oa:canonical` only when provided */
  canonical?: string
  /** A timestamp in xsd:dateTime format - defaults to now */
  datetime?: string
  /** Annotation-level language (BCP-47); independent of body.language */
  language?: string
  /** Annotation-level license IRI; independent of body.license */
  license?: string
  /** Annotation-level rights IRI; independent of body.rights */
  rights?: string
  target: AnnotationTarget
  body?: {
    /** Optional; empty/omitted content is allowed */
    content?: string
    /** Comma-separated tag string */
    tags?: string
    /** well-known token (`tagging`/`oa:tagging`/IRI) or any other purpose as a full IRI (see Purpose) */
    purpose?: Purpose
    /** Body content language (BCP-47) */
    language?: string
    /** Body-specific license IRI */
    license?: string
    /** Body-specific rights IRI */
    rights?: string
    /** media type of content; defaults to `text/html` */
    format?: string
  }
  creator?: AnnotationCreator
}

/** Human-readable labels emitted in rendered HTML; default to English. Motivation labels are overridden separately via `SerializeOptions.motivationLabels`. */
export interface AnnotationLabels {
  authors: string
  created: string
  language: string
  license: string
  rights: string
  cached: string
  inbox: string
  canonical: string
  tags: string
  classifications: string
  note: string
  renderedVia: string
  partOf: string
  selector: string
  refinedBy: string
  startSelector: string
  endSelector: string
  fragmentConformsTo: string
  rfc3987: string
  sourceDate: string
  sourceDateStart: string
  sourceDateEnd: string
  httpRequest: string
}

export interface MotivationLabelOverride {
  /** heading verb, e.g. `replies` */
  label?: string
  /** target link text, e.g. `In reply to` */
  targetLabel?: string
  /** fallback body text when a body has no value */
  bodyAltLabel?: string
}

export interface SerializeOptions {
  /** Top heading level; body Note uses headingLevel + 1. Defaults to 1 */
  headingLevel?: number
  /** RDFa subject for `<article about="...">`. Defaults to annotation IRI, else `#<id>` */
  about?: string
  /** Localized label overrides. Unset slots fall back to English */
  labels?: Partial<AnnotationLabels>
  /** Per-motivation overrides, keyed by motivation IRI */
  motivationLabels?: Record<string, MotivationLabelOverride>
  /** Map of license IRI to display name */
  licenses?: Record<string, { name: string }>
  /** Resolve a display image for the creator. Return undefined to fall back to `creator.image`. No image means no avatar is rendered. Use for proxy URLs, contact lookups, etc. */
  resolveImage?: (creator: Partial<AnnotationCreator>) => string | undefined
  /** Resolve a display name for the creator. Return undefined to fall back to `creator.name` then `creator.iri`. */
  resolveName?: (creator: Partial<AnnotationCreator>) => string | undefined
  /** Resolve a language code to a display name. Return undefined to fall back to the bare code. */
  resolveLanguageName?: (code: string) => string | undefined
}

/** Options for rendering highlight mark(s). The library emits the fragment RDFa itself: each wrapping `<span>` is a `dcterms:hasPart` / `dcmitype:Text` resource whose `<mark>` holds its `rdf:value`. */
export interface MarkOptions {
  /** target of the default reference link */
  annotationUrl: string
  /** `<mark>` `@id` and `<span>` `@resource="#{id}"`; defaults to a random id */
  id?: string
  /** class(es) on each wrapping `<span>` */
  className?: string
  /** reference marker appended after the final mark; defaults to a link to annotationUrl */
  reference?: string
  /** extra attributes on the `<span>` (caller-owned) */
  wrapperAttrs?: Record<string, string>
  /** extra attributes on the `<mark>` (caller-owned) */
  markAttrs?: Record<string, string>
}
