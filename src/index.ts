export {
  selectionToTextQuote,
  setSelectionFromTextQuote,
  setSelectionByOffset,
  findTextQuoteOffsets,
  getTextContent,
  offsetInContainer,
  type TextMatchOptions,
} from './text-quote.js'

export { resolveSelectorToRange } from './resolve.js'

export {
  getTextQuoteSelector,
  getTextPositionSelector,
  getXPathSelector,
  getFragmentSelector,
  getRangeSelector,
  refine,
  getTimeState,
  getHttpRequestState,
  statesToSelectors,
} from './build-selectors.js'

export {
  selectionToSelectors,
  rangeToSelectors,
  type SelectorType,
  type SelectionToSelectorsOptions,
  type SelectorsResult,
  type RequestStateInput,
} from './select.js'

export {
  getSelectedParentElement,
  rangeSelectsSingleNode,
  exportSelection,
  cloneSelection,
  restoreSelection,
  type ClonedRange,
} from './selection.js'

export {
  tagsToBodyObjects,
  createAnnotation,
} from './annotation.js'

export { generateId } from './id.js'

export {
  serializeAnnotationToHTML,
  serializeAnnotation,
  type SerializeFormat,
} from './serialize.js'

export {
  serializeAnnotationToJSONLD,
  WEB_ANNOTATION_CONTEXT,
  type JSONLDOptions,
} from './jsonld.js'

export {
  createAnnotationMarkHTML,
  markSegmentHTML,
  defaultReference,
  DCMITYPE_TEXT,
} from './mark.js'

export {
  applyMark,
  applyMarkFromSelector,
  restoreMarks,
  applyMarksFromTextQuote,
} from './dom-mark.js'

export {
  parseStoredAnnotation,
  parseAnnotation,
  type JSONLDParser,
  type JSONLDNode,
} from './parse.js'

export { WELL_KNOWN_PURPOSES, purposeToken } from './purpose.js'

export type {
  TextQuoteSelector,
  FragmentSelector,
  TextPositionSelector,
  XPathSelector,
  RangeSelector,
  Selector,
  TimeState,
  HttpRequestState,
  State,
  AnnotationCreator,
  AnnotationBodyObject,
  AnnotationTarget,
  AnnotationLabels,
  MotivationLabelOverride,
  Annotation,
  CreateAnnotationParams,
  SerializeOptions,
  MarkOptions,
  WellKnownPurpose,
  Purpose,
} from './types.js'
