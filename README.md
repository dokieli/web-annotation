# dokieli Web Annotation

W3C Web Annotation implementation for creating, parsing, and serializing Web Annotations in JSON-LD, with support for HTML+RDFa embedding and DOM-based annotation application.

* [Code of Conduct](CODE-OF-CONDUCT.md)
* [Contributing Guide](CONTRIBUTING.md)
* [API Reference](docs.md)
* [Security Policy](SECURITY.md)

## License

* Source code is licensed under the [Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0).
* Unless otherwise noted, images and other media assets are licensed under the [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).

## Installation

```sh
npm install @dokieli/web-annotation
```

or

```sh
yarn install @dokieli/web-annotation
```

```js
import { createAnnotation, serializeAnnotationToJSONLD, serializeAnnotationToHTML } from '@dokieli/web-annotation';

const annotation = createAnnotation({
  motivatedBy: 'oa:commenting',
  body: { value: 'A note.' },
  target: { source: 'https://example.org/', selector: { type: 'TextQuoteSelector', exact: 'annotated text' } }
});

const jsonld = serializeAnnotationToJSONLD(annotation);
const html = serializeAnnotationToHTML(annotation);
```

## Documentation

See [API Reference](docs.md) and [Examples](examples/).

## Features

* Parsing and serializing annotations in JSON-LD and HTML+RDFa.
* Support for selectors and states.
* Restoring the selection object from a stored selector.
* Marking the annotated text (the target) in the DOM.

## Specifications

* W3C [Web Annotation Model](https://www.w3.org/TR/annotation-model/)
* W3C [Web Annotation Vocabulary](https://www.w3.org/TR/annotation-vocab/)
* W3C [Selectors and States](https://www.w3.org/TR/selectors-states/)
* W3C [Embedding Web Annotations in HTML](https://www.w3.org/TR/annotation-html)

## Conformance

The data in JSON-LD this library emits conforms to the W3C Web Annotation Data Model, validated against the official [w3c/web-annotation-tests](https://github.com/w3c/web-annotation-tests) suite (its MUST assertions). Run the checks with `yarn test:conformance`.

## Contributing

See the [Contributing Guide](CONTRIBUTING.md) for development setup, tests, and commit conventions.

## Supported By

* This project was funded by [NLnet](https://nlnet.nl/) (2025-09–2026-06) as part of [NLnet Dokieli Collaborative](https://nlnet.nl/project/Dokieli-Collaborative/).

## Support the project

Help the project grow by sponsoring it on [Open Collective](https://opencollective.com/dokieli/) or reach out to us.
