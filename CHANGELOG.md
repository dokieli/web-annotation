# Changelog

## [1.0.1](https://github.com/dokieli/web-annotation/compare/v1.0.0...v1.0.1) (2026-07-09)


### Bug Fixes

* Update refined by markup structure and use specific labels ([f474a4e](https://github.com/dokieli/web-annotation/commit/f474a4e01f66855f88c054a2f5cd79fc77079eb4))

## 1.0.0 (2026-07-08)

Making it so! Initial release of `@dokieli/web-annotation` - a W3C Web Annotation implementation. Source code derived and extended from https://git.dokie.li/ .

### Features

* Create, serialize, and parse W3C Web Annotations, with JSON-LD and HTML+RDFa output.
* Typed selectors (TextQuote, TextPosition, Fragment, XPath, Range) and states (TimeState, HttpRequestState), including cross-node RangeSelector.
* DOM anchoring: compute selectors from a selection, resolve any selector back to a Range, and apply/restore highlight marks.
* Validated against the W3C `web-annotation-tests` conformance suite.
