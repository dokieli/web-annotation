# @dokieli/web-annotation - API Reference

Core utilities for creating, serializing, parsing, and anchoring W3C Web Annotations.

---

## Table of contents

- [Types](#types)
- [text-quote](#text-quote)
- [build-selectors](#build-selectors)
- [select](#select)
- [selection](#selection)
- [annotation](#annotation)
- [serialize](#serialize)
- [mark](#mark)
- [dom-mark](#dom-mark)
- [parse](#parse)

---

## Types

Defined in `src/types.ts`. All types are re-exported from the package root.

```ts
import type { Annotation, TextQuoteSelector, ... } from '@dokieli/web-annotation'
```

---

### Selectors

W3C Web Annotation selectors are modelled as a [discriminated union](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions) on `type`. Every selector carries an explicit `type` discriminant and an optional `id`, and selectors may be nested via `refinedBy` (a single selector or an array).

```ts
type Selector =
  | TextQuoteSelector
  | TextPositionSelector
  | FragmentSelector
  | XPathSelector
  | RangeSelector
```

#### `TextQuoteSelector`

A [TextQuoteSelector](https://www.w3.org/TR/annotation-model/#text-quote-selector) identifying a passage by its exact content and surrounding context.

```ts
interface TextQuoteSelector {
  type: 'TextQuoteSelector'
  id?: string
  exact: string       // The selected text
  prefix?: string     // Up to N characters immediately before the selection
  suffix?: string     // Up to N characters immediately after the selection
  language?: string
  refinedBy?: Selector | Selector[]
}
```

#### `TextPositionSelector`

A [TextPositionSelector](https://www.w3.org/TR/annotation-model/#text-position-selector) identifying a passage by the start and end positions of the selection in the stream.

```ts
interface TextPositionSelector {
  type: 'TextPositionSelector'
  id?: string
  start: number
  end: number
  refinedBy?: Selector | Selector[]
}
```

#### `FragmentSelector`

A [FragmentSelector](https://www.w3.org/TR/annotation-model/#fragment-selector) identifying a segment by a media fragment (RFC 3987 by default).

```ts
interface FragmentSelector {
  type: 'FragmentSelector'
  id?: string
  value: string         // e.g. element id, 'char=10,20', 'xywh=10,20,30,40'
  conformsTo?: string   // defaults to RFC 3987 when rendered
  refinedBy?: Selector | Selector[]
}
```

#### `XPathSelector`

A [XPathSelector](https://www.w3.org/TR/annotation-model/#xpath-selector) identifying selected elements and content within a resource that supports the DOM (such as XML or HTML).

```ts
interface XPathSelector {
  type: 'XPathSelector'
  id?: string
  value: string // an XPath e.g., /html[1]/body[1]/article[1]/p[1]
  refinedBy?: Selector | Selector[]
}
```

#### `RangeSelector`

A [RangeSelector](https://www.w3.org/TR/annotation-model/#range-selector) identifying content that cross over internal boundaries in the representation.

```ts
interface RangeSelector {
  type: 'RangeSelector'
  id?: string
  startSelector: Selector // e.g., an XPath
  endSelector: Selector // e.g., an XPath
  refinedBy?: Selector | Selector[]
}
```

> **Scope note:** All selector types round-trip end to end. DOM computation (`selection -> selector`, see [`selectionToSelectors`](#selectiontoselectors)), serialization ([`serializeAnnotationToHTML`](#serializeannotationtohtml) / [`serializeAnnotationToJSONLD`](#serializeannotationtojsonld)), parsing ([`parseStoredAnnotation`](#parsestoredannotation)), and DOM resolution ([`resolveSelectorToRange`](#resolveselectortorange) / [`applyMarkFromSelector`](#applymarkfromselector)). A cross-node selection is captured as a `RangeSelector` (XPath start/end, each refined by a TextQuote + TextPosition).

### States

A State describes the intended state of a resource as applied to the particular Annotation

```ts
type State = TimeState | HttpRequestState
```

#### `TimeState`

A [TimeState](https://www.w3.org/TR/annotation-model/#time-state) records the time at which the resource is appropriate for the annotation.

```ts
interface TimeState {
  type: 'TimeState'
  id?: string
  sourceDate?: string        // A timestamp in xsd:dateTime format.
  sourceDateStart?: string   // A timestamp in xsd:dateTime format.
  sourceDateEnd?: string     // A timestamp in xsd:dateTime format.
  cached?: string            // IRI of a memento/cached copy
  refinedBy?: State | State[]
}
```

#### `HttpRequestState`

A [HttpRequestState](https://www.w3.org/TR/annotation-model/#request-header-state) records the HTTP Request headers that need to be sent to retrieve the correct representation.

```ts
interface HttpRequestState {
  type: 'HttpRequestState'
  id?: string
  value: string | string[]   // e.g. 'Accept: text/html'
  refinedBy?: Selector | Selector[]
}
```

---

### `AnnotationCreator`

Identity of the annotation's author.

```ts
interface AnnotationCreator {
  iri?: string       // An IRI that identifiers the creator of the annotation (e.g. 'https://alice.example/#me')
  name?: string      // Display name
  image?: string     // Avatar URL or data URI
  url?: string       // Profile URL (if different from IRI)
  type?: string | string[]  // Agent type IRI(s) from the profile; omitted when absent
}
```

---

### `AnnotationBodyObject`

A single body item in a Web Annotation. Annotations have one body object for the textual content and additional ones for tags.

```ts
interface AnnotationBodyObject {
  id?: string
  value: string
  purpose?: Purpose  // see Purpose below
  language?: string  // e.g., 'en-GB'
  license?: string   // e.g., https://creativecommons.org/licenses/by/4.0/
  rights?: string    // e.g., https://creativecommons.org/licenses/by/4.0/
  format?: string    // media type of the value, e.g. 'text/html' (emitted as dc:format)
}
```

---

### `Purpose`

The purpose of a body ([oa:hasPurpose](https://www.w3.org/TR/annotation-model/#motivation-and-purpose)).

```ts
type WellKnownPurpose = 'describing' | 'tagging' | 'classifying'
type Purpose = WellKnownPurpose | (string & {})
```

The library renders the three **well-known** purposes specially — `describing` as a Note section, `tagging` as a tags list, `classifying` as a classifications list — and accepts each as a short token (`'tagging'`), a prefixed name (`'oa:tagging'`), or the full oa IRI; all normalize to the short WA token in the output. Any **other** purpose is a caller concern: pass it as a full IRI (a bare unknown token isn't a valid `resource`) and the library emits it verbatim as `oa:hasPurpose` on a generic Note section. `WELL_KNOWN_PURPOSES` and `purposeToken(value)` (the normalizer) are exported.

---

### `AnnotationTarget`

The document passage being annotated.

```ts
interface AnnotationTarget {
  iri: string                  // IRI of the targeted section (with fragment)
  source: string               // IRI of the source document (without fragment)
  selector?: Selector          // Any selector (see Selectors above)
  state?: State | State[]      // Optional time/HTTP-request state(s)
  language?: string            // Language of the target resource
  rel?: string                 // RDFa relation for the rendered target link (defaults to 'oa:hasTarget'; e.g. 'as:inReplyTo' for replies)
  renderedVia?: { iri: string; name?: string }  // Tool that rendered the target at annotation time; name is display-only
}
```

---

### `Annotation`

The full annotation data object. Produced by [`createAnnotation`](#createannotation), consumed by [`serializeAnnotationToHTML`](#serializeannotationtohtml) / [`serializeAnnotationToJSONLD`](#serializeannotationtojsonld).

Note: the annotation carries no rendering state. Presentation choices (heading level, RDFa subject) are passed to the serializer via [`SerializeOptions`](#serializeoptions).

```ts
interface Annotation {
  motivatedBy: string              // A W3C Web Annotation motivation, e.g. oa:replying, or another https://www.w3.org/TR/annotation-vocab/#extending-motivations
  id: string                       // UUID
  canonical: string                // stable identifier; 'urn:uuid:<id>' fallback unless the client supplies one
  creator: Partial<AnnotationCreator>
  datetime: string                 // A timestamp in xsd:dateTime format.
  target: AnnotationTarget
  body: AnnotationBodyObject[]      // embedded TextualBody objects (value + optional format/language/purpose)
  language?: string                // e.g., a language tag from BCP-47
  license?: string                 // e.g., https://creativecommons.org/licenses/by/4.0/
  rights?: string                  // e.g., https://creativecommons.org/licenses/by/4.0/
  inbox?: string                   // Annotation's own notifications inbox IRI (caller-assigned; serialized as ldp:inbox)
  iri?: string                     // Set after posting; default RDFa subject and datetime link target
  bodyValue?: string               // Simple plain-text embedded body (oa:bodyValue; alternative to body array)
}
```

Use `body` (a `TextualBody`) when the body needs `format`/`language`/`license`/`purpose` or tags; use `bodyValue` for plain text with no metadata. Citation modelling and inline reference markers are the consumer's concern, not part of this type.

---

### `CreateAnnotationParams`

Input type for [`createAnnotation`](#createannotation).

```ts
interface CreateAnnotationParams {
  motivatedBy: string  // Required. Motivation IRI, e.g. 'oa:replying', 'oa:highlighting', 'as:Like'
  id?: string          // UUID - generated via crypto.randomUUID() if omitted
  iri?: string         // Subject IRI used verbatim by both serializers (e.g. '' for write-then-POST, or a base#fragment)
  canonical?: string   // Optional stable identifier; emitted as oa:canonical only when provided
  datetime?: string    // A timestamp in xsd:dateTime format - defaults to now
  target: AnnotationTarget
  body?: {
    content?: string   // Optional; empty/omitted content is allowed
    tags?: string      // Comma-separated tag string
    purpose?: Purpose  // well-known token ('tagging'/'oa:tagging'/IRI) or any other purpose as a full IRI (see Purpose)
    language?: string  // e.g., a language tag from BCP-47
    license?: string   // License IRI
    format?: string    // media type of content; defaults to 'text/html'
  }
  creator?: AnnotationCreator
}
```

---

### `AnnotationLabels`

Human-readable labels emitted in the rendered HTML. The serializer defaults every slot to English; pass a `Partial<AnnotationLabels>` via [`SerializeOptions.labels`](#serializeoptions) to localize. Per-motivation labels (`replies`, `In reply to`, ...) are overridden separately via `SerializeOptions.motivationLabels`.

```ts
interface AnnotationLabels {
  authors; created; language; license; rights; inbox; canonical
  tags; classifications; note; renderedVia; partOf
  selector; refinedBy; startSelector; endSelector; fragmentConformsTo; rfc3987
  sourceDate; sourceDateStart; sourceDateEnd; cached; httpRequest
} // all string
```

### `MotivationLabelOverride`

Per-motivation label overrides, keyed by motivation IRI in `SerializeOptions.motivationLabels`.

```ts
interface MotivationLabelOverride {
  label?: string         // heading verb, e.g. 'replies'
  targetLabel?: string   // target link text, e.g. 'In reply to'
  bodyAltLabel?: string  // fallback body text when a body has no value
}
```

---

### `SerializeOptions`

Options for [`serializeAnnotationToHTML`](#serializeannotationtohtml).

```ts
interface SerializeOptions {
  headingLevel?: number                          // Top heading level; body Note uses headingLevel + 1. Defaults to 1
  about?: string                                 // RDFa subject for <article about="...">. Defaults to annotation IRI, else '#<id>'
  labels?: Partial<AnnotationLabels>             // Localized label overrides. Unset slots fall back to English
  motivationLabels?: Record<string, MotivationLabelOverride>  // Per-motivation overrides, keyed by motivation IRI
  licenses?: Record<string, { name: string }>   // Map of license IRI -> display name
  // Resolve a display image for the creator. Return undefined to fall back to creator.image.
  // No image -> no avatar is rendered. Use for proxy URLs, contact lookups, etc.
  resolveImage?: (creator: Partial<AnnotationCreator>) => string | undefined
  // Resolve a display name for the creator. Return undefined to fall back to creator.name -> creator.iri.
  resolveName?: (creator: Partial<AnnotationCreator>) => string | undefined
  // Resolve a language code to a display name. Return undefined to fall back to the bare code.
  resolveLanguageName?: (code: string) => string | undefined
}
```

---

### `ClonedRange`

A cloned selection entry, returned by [`cloneSelection`](#cloneselection). Exported for consumers that need to store selection state.

```ts
interface ClonedRange {
  range: Range
  fragment: DocumentFragment
}
```

---

## text-quote

Text/offset primitives: convert between DOM selections and TextQuoteSelectors, and resolve any selector to a `Range`. No dependencies beyond DOM APIs.

```ts
import {
  selectionToTextQuote, setSelectionFromTextQuote, setSelectionByOffset,
  findTextQuoteOffsets, resolveSelectorToRange, getTextContent, offsetInContainer,
  type TextMatchOptions,
} from '@dokieli/web-annotation'
```

`TextMatchOptions` is `{ ignoreSelector?: string }` - a CSS selector for subtrees to skip when measuring text/offsets (e.g. `'sup'` reference markers injected after a passage is annotated, so offsets stay stable across multiple annotations).

---

### `selectionToTextQuote`

Converts the current DOM selection to a `TextQuoteSelector`.

```ts
function selectionToTextQuote(
  containerNode: Element,
  selection: Selection,
  options?: { contextLength?: number }  // Default: 32
): TextQuoteSelector | null
```

Returns `null` if there is no selection. `contextLength` controls how many characters are captured as prefix/suffix. For multi-selector computation (Range/XPath/Fragment/Position), use [`selectionToSelectors`](#selectiontoselectors).

---

### `setSelectionFromTextQuote`

Restores a DOM selection from a TextQuoteSelector. Uses prefix and suffix to disambiguate when the same text appears multiple times; falls back to exact-only match.

```ts
function setSelectionFromTextQuote(
  containerNode: Element,
  selector: Pick<TextQuoteSelector, 'exact' | 'prefix' | 'suffix'>,
  options?: TextMatchOptions
): boolean  // true if found and selected, false if text not found
```

---

### `setSelectionByOffset`

Sets the DOM selection to a character offset range within `containerNode`. Lower-level than `setSelectionFromTextQuote`; use when you have numeric offsets.

```ts
function setSelectionByOffset(start: number, end: number, containerNode: Element, options?: TextMatchOptions): void
```

---

### `findTextQuoteOffsets`

Returns every `{ start, end }` offset range where the selector's phrase occurs in `containerNode`.

```ts
function findTextQuoteOffsets(
  containerNode: Element,
  selector: Pick<TextQuoteSelector, 'exact' | 'prefix' | 'suffix'>,
  options?: TextMatchOptions
): Array<{ start: number; end: number }>
```

---

### `resolveSelectorToRange`

Resolves **any** selector type to a DOM `Range` within `containerNode` - TextQuote, TextPosition, XPath (with `refinedBy`), Fragment (by element id), and Range (start/end resolved recursively). Returns `null` if the selector doesn't resolve. XPath resolution uses `document.evaluate` when available and falls back to a positional element walker.

```ts
function resolveSelectorToRange(containerNode: Element, selector: Selector, options?: TextMatchOptions): Range | null
```

---

### `getTextContent`

Returns a node's text content, optionally skipping subtrees matching `ignoreSelector`.

```ts
function getTextContent(container: Node, ignoreSelector?: string): string
```

Pass e.g. `'sup'` to exclude reference markers injected after annotating, so their characters don't shift surrounding offsets (see [`TextMatchOptions`](#text-quote)).

### `offsetInContainer`

Character offset of a `(boundaryNode, boundaryOffset)` DOM position within `container`, honoring `ignoreSelector`.

```ts
function offsetInContainer(container: Node, boundaryNode: Node, boundaryOffset: number, ignoreSelector?: string): number
```

---

## build-selectors

Pure builders that turn a DOM `Range` into individual selectors/states (used by [`select`](#select)). Each generated selector gets a fresh `id`.

```ts
import {
  getTextQuoteSelector, getTextPositionSelector, getXPathSelector, getFragmentSelector,
  getRangeSelector, refine, getTimeState, getHttpRequestState, statesToSelectors,
} from '@dokieli/web-annotation'
```

```ts
function getTextQuoteSelector(range: Range, container: Element, options?: { contextLength?: number; ignoreSelector?: string }): TextQuoteSelector
function getTextPositionSelector(range: Range, container: Element, options?: { ignoreSelector?: string }): TextPositionSelector
function getXPathSelector(node: Node): XPathSelector
function getFragmentSelector(node: Node, options?: { climb?: boolean }): FragmentSelector | null  // climb defaults to true (walk up to the nearest id)
function getRangeSelector(startSelector: Selector, endSelector: Selector): RangeSelector
function refine<S extends Selector>(selector: S, refinedBy: Selector | Selector[]): S  // attaches refinedBy, returns the same selector
function getTimeState(opts: { sourceDate?; sourceDateStart?; sourceDateEnd?; cached?; refinedBy? }): TimeState
function getHttpRequestState(opts: { value: string | string[]; refinedBy? }): HttpRequestState
function statesToSelectors(state: State | State[]): Selector[]  // selectors nested under a state's refinedBy chain
```

---

## select

Computes W3C selectors (and optional state) from a DOM selection or range. This is the `selection -> selector` entry point; it produces co-equal selector alternatives (W3C §4.2) and the consumer picks one.

```ts
import { selectionToSelectors, rangeToSelectors, type SelectorType, type SelectionToSelectorsOptions, type SelectorsResult, type RequestStateInput } from '@dokieli/web-annotation'
```

```ts
type SelectorType = 'TextQuoteSelector' | 'TextPositionSelector' | 'FragmentSelector' | 'XPathSelector' | 'RangeSelector' | 'auto'

interface SelectionToSelectorsOptions {
  container: Element            // measuring root for the top-level quote/position
  selectorType?: SelectorType   // default 'auto' - runs the rule table
  contextLength?: number
  ignoreSelector?: string       // subtrees omitted from offset/quote measurement
  requestState?: RequestStateInput
}

interface SelectorsResult {
  selectors: Selector[]         // co-equal alternatives; consumer picks one
  state?: State                 // set when requestState was supplied
}

interface RequestStateInput { sourceDate?; sourceDateStart?; sourceDateEnd?; cached?; request: string | string[] }
```

### `selectionToSelectors`

```ts
function selectionToSelectors(selection: Selection, options: SelectionToSelectorsOptions): SelectorsResult | null
```

Returns `null` if the selection is empty; otherwise delegates to `rangeToSelectors` on the first range.

### `rangeToSelectors`

```ts
function rangeToSelectors(range: Range, options: SelectionToSelectorsOptions): SelectorsResult | null
```

With `selectorType: 'auto'` (default), a rule table fires every matching rule and returns all their selectors:

- **fragment** - same start/end node with an ancestor carrying an `id` -> `FragmentSelector` refined by TextQuote + TextPosition.
- **range** - a cross-node selection -> `RangeSelector` whose start/end are `XPathSelector`s, each refined by TextQuote + TextPosition.
- **text** (always) - a top-level `TextQuoteSelector` + `TextPositionSelector` measured against `container`.

A forced `selectorType` yields exactly that one selector. `requestState` attaches a `TimeState -> HttpRequestState -> [quote, position]` chain as `result.state`.

---

## selection

DOM selection utilities for preserving selections across focus changes (e.g. when a form opens).

```ts
import { cloneSelection, restoreSelection, exportSelection, getSelectedParentElement, rangeSelectsSingleNode } from '@dokieli/web-annotation'
```

### `cloneSelection`

Clones all ranges in the current DOM selection so they can be restored after focus moves elsewhere.

```ts
function cloneSelection(): ClonedRange[] | null  // null if no active selection
```

### `restoreSelection`

Restores a previously cloned selection.

```ts
function restoreSelection(clonedSelection: ClonedRange[] | null): void
```

### `exportSelection`

Returns the start and end character offsets of the current selection relative to `selectedParentElement`, merging multiple ranges into one.

```ts
function exportSelection(selectedParentElement: Element, selection: Selection): { start: number; end: number } | undefined
```

### `getSelectedParentElement`

Returns the closest element ancestor of the selection's start point.

```ts
function getSelectedParentElement(range: Range): Element | null
```

### `rangeSelectsSingleNode`

Returns `true` if the range selects exactly one child node of its container.

```ts
function rangeSelectsSingleNode(range: Range): boolean
```

---

## annotation

Functions for building annotation data objects. No DOM side effects.

```ts
import { createAnnotation, tagsToBodyObjects, generateId } from '@dokieli/web-annotation'
```

### `createAnnotation`

Creates a W3C Web Annotation data object from a motivation IRI.

The motivation is passed directly (e.g., `oa:replying`, `oa:highlighting`, `oa:commenting`, `oa:bookmarking`, `as:Like`, ...); there is no built-in action->motivation mapping. Reply, note, highlight, classify (`body.purpose: 'classifying'`) and bookmark are all expressed through `motivatedBy` + body purpose. ActivityStreams reply semantics (`as:inReplyTo`) and notification wrapping are the caller's responsibility - a reply sets the target `rel` (e.g. `target.rel: 'as:inReplyTo'`).

```ts
function createAnnotation(params: CreateAnnotationParams): Annotation
```

**Throws** if `motivatedBy` or `target` is missing. Content is optional - a body object is built when content/purpose is supplied or the motivation conventionally carries one; empty content is allowed (a bare assessment or like need not have a textual body).

```ts
const annotation = createAnnotation({
  motivatedBy: 'oa:replying',
  target: {
    iri: 'https://example.org/article#section-2',
    source: 'https://example.org/article',
    selector: { type: 'TextQuoteSelector', exact: 'web annotations', prefix: 'using ', suffix: ' to build' },
  },
  body: {
    content: 'Great point about web annotations.',
    tags: 'rdf, web',
    language: 'en',
    license: 'https://creativecommons.org/licenses/by/4.0/',
  },
  creator: { iri: 'https://alice.example/#me', name: 'Alice' },
})

// Reply (caller sets the ActivityStreams target relation)
createAnnotation({
  motivatedBy: 'oa:replying',
  target: { iri: noteIRI, source: noteIRI, rel: 'as:inReplyTo' },
  body: { content: 'I agree.' },
})

// Internal note (editor handles DOM insertion)
createAnnotation({ motivatedBy: 'oa:commenting', target, body: { content: '...' } })
```

### `tagsToBodyObjects`

Converts a comma-separated tag string into Web Annotation body objects. Sorts alphabetically and deduplicates. Pass `'classifying'` as the second argument for semantic classification bodies.

```ts
function tagsToBodyObjects(string: string, purpose?: 'tagging' | 'classifying'): Array<{ purpose: 'tagging' | 'classifying'; value: string }>
```

```ts
tagsToBodyObjects('rdf, web, rdf')
// [{ purpose: 'tagging', value: 'rdf' }, { purpose: 'tagging', value: 'web' }]
```

### `generateId`

Returns a short, XML-`id`-safe identifier (a UUID fragment guaranteed to start with a non-digit). Used internally for selector/state/body ids; exported for convenience.

```ts
function generateId(): string
```

---

## serialize

Serializes annotation data to RDFa-annotated HTML (dokieli's native format) or to W3C Web Annotation JSON-LD (the conformant serialization).

```ts
import { serializeAnnotation, serializeAnnotationToHTML, serializeAnnotationToJSONLD } from '@dokieli/web-annotation'
```

### `serializeAnnotation`

Format-dispatching entry point.

```ts
type SerializeFormat = 'rdfa' | 'html' | 'jsonld'

function serializeAnnotation(
  annotation: Annotation,
  options?: SerializeOptions & JSONLDOptions & { format?: SerializeFormat }
): string | Record<string, unknown>
```

- `'jsonld'` (default) -> a W3C Web Annotation JSON-LD **object** (via `serializeAnnotationToJSONLD`); `JSON.stringify` it for the wire.
- `'rdfa'` / `'html'` -> an HTML+RDFa **string** (via `serializeAnnotationToHTML`).

```ts
const ld   = serializeAnnotation(annotation)                      // WA JSON-LD object (default)
const html = serializeAnnotation(annotation, { format: 'html' }) // HTML+RDFa string

await fetch('/annotations/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/ld+json' },
  body: JSON.stringify(ld),
})
```

> Core natively emits JSON-LD and HTML+RDFa only (it is dependency-free). For Turtle/N-Triples/etc., run an RDF tool over either output (this is what dokieli does via `rdf-ext` during `Accept-Post` content negotiation).

### `serializeAnnotationToJSONLD`

Serializes an `Annotation` into a conformant W3C Web Annotation JSON-LD object.

```ts
function serializeAnnotationToJSONLD(annotation: Annotation, options?: JSONLDOptions): Record<string, unknown>

interface JSONLDOptions {
  context?: string | (string | Record<string, unknown>)[]  // defaults to the WA context
}
```

- `@context` defaults to `WEB_ANNOTATION_CONTEXT` (`http://www.w3.org/ns/anno.jsonld`). Callers needing additional contexts (e.g. ActivityStreams for notification wrapping) pass them via `options.context`.
- `oa:` motivations become short WA tokens (`oa:replying` -> `"replying"`); non-`oa:` motivations (e.g. `as:Like`) are expanded to full IRIs.
- The typed `Selector` union and `State` map directly to WA `selector` / `state`. Bodies become `TextualBody` objects (tags carry `purpose: "tagging"`). A target with no selector/state is emitted as a plain IRI string.

```ts
const jsonld = serializeAnnotationToJSONLD(annotation)
// { "@context": "http://www.w3.org/ns/anno.jsonld", "type": "Annotation",
//   "motivation": "replying", "target": { "source": "...", "selector": { "type": "TextQuoteSelector", ... } }, ... }
```

Also exported: `WEB_ANNOTATION_CONTEXT`.

### `serializeAnnotationToHTML`

Converts an `Annotation` object to an HTML+RDFa string, suitable for POSTing to an annotation service that supports it or embedding in a document.

```ts
function serializeAnnotationToHTML(annotation: Annotation, options?: SerializeOptions): string
```

Output is a single uniform `<article ... typeof="oa:Annotation">` element containing creator, datetime, language, license, canonical IRI, the target selector(s), body sections, tags, and inbox — the same shape for every annotation. The heading level and RDFa subject come from `options.headingLevel` / `options.about`; the serializer emits no interactive controls (e.g. delete buttons) and does **not** special-case any `type`. Consumers that need alternative inline forms (footnotes, citations) render those themselves.

Language codes are resolved to display names via `options.resolveLanguageName` (else the bare code). License display names fall back to the raw IRI if not found in `options.licenses`. Creator name and avatar can be overridden per call via `options.resolveName` / `options.resolveImage`.

```ts
const html = serializeAnnotationToHTML(annotation, {
  headingLevel: 3,
  licenses: { 'https://creativecommons.org/licenses/by/4.0/': { name: 'CC BY 4.0' } },
})
```

---

## mark

Produces RDFa-annotated mark HTML **strings** for an annotation's selected passage. The library emits the fragment markup itself: the wrapping `<span>` is a `dcterms:hasPart` / `dcmitype:Text` resource (`resource="#{id}"`) whose `<mark>` holds its `rdf:value`. The tie to the annotation lives on the **reference marker** (`options.reference`, or the default link).

```ts
import { createAnnotationMarkHTML, markSegmentHTML } from '@dokieli/web-annotation'
```

`MarkOptions` (see [Types](#types)): `{ annotationUrl, id?, className?, reference?, wrapperAttrs?, markAttrs? }`. `annotationUrl` is the annotation resource — the target of the default `reference` link (use it after posting, when the URL exists). `id` becomes the `<mark>` id and the `<span>` `resource="#{id}"` (defaults to a random id). `reference` is the caller-owned marker (e.g. a `<sup>`) appended after the final mark; if omitted the library appends `<a href="{annotationUrl}" rel="rdfs:seeAlso">...</a>`. `wrapperAttrs`/`markAttrs` add extra attributes to the `<span>`/`<mark>`. `defaultReference(annotationUrl)` is exported.

### `createAnnotationMarkHTML`

Returns `<span><mark>...</mark></span>` for an annotation, embedding `annotation.target.selector.exact` (HTML-encoded) as the text content. Defaults `id` to `r-${annotation.id}`.

```ts
function createAnnotationMarkHTML(annotation: Annotation, options: MarkOptions): string
```

### `markSegmentHTML`

Lower-level: wraps arbitrary content HTML in the same `<span><mark>...</mark></span>` structure. `createAnnotationMarkHTML` is a thin wrapper over this.

```ts
function markSegmentHTML(contentHTML: string, options: MarkOptions): string
```

```html
<span class="ref" rel="dcterms:hasPart" resource="#<id>" typeof="http://purl.org/dc/dcmitype/Text">
  <mark datatype="rdf:HTML" property="rdf:value" id="<id>">exact text</mark>
  <!-- options.reference appended here (or the default link) -->
</span>
```

Use these for the string form (serialized documents). For in-browser DOM application - which preserves inline markup inside the selection and splits a highlight across block boundaries - use [`applyMark`](#applymark).

---

## dom-mark

Live-DOM highlight functions. Unlike the string builders, these operate on the real DOM and preserve inline markup inside the selection.

```ts
import { applyMark, applyMarkFromSelector, restoreMarks, applyMarksFromTextQuote } from '@dokieli/web-annotation'
```

### `applyMark`

Wraps a `Range`'s text in `<span dcterms:hasPart ...><mark rdf:value>...</mark></span>` in place. A highlight that crosses block boundaries is split into **one mark per text node** (a single mark can't validly span `</p>`); each segment gets a unique id derived from `options.id`. `reference` (or the default link) is appended once, after the final mark. Returns the last span created, or `null`.

```ts
function applyMark(range: Range, options: MarkOptions & { ignoreSelector?: string }): Element | null
```

### `applyMarkFromSelector`

Resolves any selector type to a DOM range (via [`resolveSelectorToRange`](#resolveselectortorange)) and marks it - use this for selectors beyond a plain `TextQuoteSelector` (e.g. a `RangeSelector` spanning nodes, or an `XPathSelector` `refinedBy` a `TextQuoteSelector`). Returns the last span, or `null` if the selector doesn't resolve.

```ts
function applyMarkFromSelector(
  container: Element,
  selector: Selector,
  options: MarkOptions & { excludeMatchesIn?: string; ignoreSelector?: string }
): Element | null
```

### `restoreMarks`

Reconstructs highlights for stored annotations by resolving each annotation's selector in `container` (**any** selector type). The annotation URL defaults to `annotation.iri`; annotations without a selector, without a URL, or whose selector doesn't resolve are skipped.

```ts
function restoreMarks(
  container: Element,
  annotations: Annotation[],
  options?: {
    className?: string
    getAnnotationUrl?: (a: Annotation) => string | undefined  // default: a.iri
    getId?: (a: Annotation) => string | undefined
    getReference?: (a: Annotation) => string | undefined
    excludeMatchesIn?: string
    ignoreSelector?: string
  }
): void
```

### `applyMarksFromTextQuote`

Marks *every* occurrence of a `TextQuoteSelector`'s phrase within `container`. Returns the last span created, or `null` if nothing matched.

```ts
function applyMarksFromTextQuote(
  container: Element,
  selector: Pick<TextQuoteSelector, 'exact' | 'prefix' | 'suffix'>,
  options: MarkOptions & { excludeMatchesIn?: string; ignoreSelector?: string }
): Element | null
```

---

## parse

Parses stored annotations from JSON-LD into the `Annotation` type.

```ts
import { parseStoredAnnotation, parseAnnotation, type JSONLDNode, type JSONLDParser } from '@dokieli/web-annotation'
```

There are two entry points. `parseStoredAnnotation` is the low-level, **synchronous, shape-tolerant** mapper for JSON-LD you already have. `parseAnnotation` is the **format-agnostic** entry: you pass *your own* parser (core stays dependency-free) for fetching / non-JSON-LD formats / custom-context expansion, then core maps the result.

### `parseStoredAnnotation`

Maps W3C Web Annotation **JSON-LD** into an `Annotation` object for `restoreMarks`, `serializeAnnotation`, etc. **Synchronous and shape-tolerant.**

```ts
type JSONLDNode = Record<string, unknown>

function parseStoredAnnotation(input: JSONLDNode | JSONLDNode[], annotationIRI?: string): Annotation | null
```

Accepts JSON-LD in any common shape - no expansion step required:

- a single annotation **object**, an **array** of nodes, or a `{ "@graph": [...] }` document;
- **compact** (WA-context short terms like `target`/`selector`/`exact`/`motivation`), **prefixed** (`oa:exact`), or **expanded** (full-IRI) keys;
- selectors/targets that are **inline-embedded** or **`@id`-referenced**; a target may be a bare IRI string.

It does **not** do `@context` resolution. For inputs whose terms don't match the W3C Web Annotation vocabulary (custom/remote contexts), expand them first - see `parseAnnotation`. Resolves the full typed selector tree (`TextQuoteSelector`, `FragmentSelector` with `refinedBy`, `TextPositionSelector`, `XPathSelector`, `RangeSelector`) and states. Unknown motivations are preserved. Returns `null` only when the input is not a recognisable annotation or has no resolvable target.

This round-trips with `serializeAnnotationToJSONLD` (object -> compact JSON-LD -> object).

```ts
const annotation = parseStoredAnnotation(await res.json(), annotationIRI)
if (annotation) restoreMarks(document.querySelector('article'), [annotation])
```

`annotationIRI` picks the annotation node when several subjects are present, and is set as `annotation.iri`. If omitted, the node is found by its `Annotation` type.

### `parseAnnotation`

Parses raw annotation data into an `Annotation` by delegating fetching / format conversion to a **caller-supplied parser**, then mapping the result with `parseStoredAnnotation`.

```ts
// A parser just turns raw input into JSON-LD (any shape). Sync or async.
type JSONLDParser = (input: unknown) => JSONLDNode | JSONLDNode[] | Promise<JSONLDNode | JSONLDNode[]>

function parseAnnotation(input: unknown, options: { parser: JSONLDParser; annotationIRI?: string }): Promise<Annotation | null>
```

Core bundles no parser - the `parser` is **required** and owns format support and dependencies. It only needs to return **valid JSON-LD** (compact or expanded); it does **not** have to flatten or expand, since `parseStoredAnnotation` is shape-tolerant. Use it for non-JSON-LD sources (RDFa/Turtle via an RDF toolkit) or to expand custom/remote contexts. If you already have JSON-LD, call `parseStoredAnnotation` directly.

```ts
// Trivial: the resource is JSON-LD, the parser just reads it.
const annotation = await parseAnnotation(res, { parser: r => r.json(), annotationIRI })

// dokieli - parse RDFa/Turtle/JSON-LD via its rdf-ext + RdfaParser stack:
const annotation = await parseAnnotation(data, { parser: graphToJSONLD, annotationIRI })
```
