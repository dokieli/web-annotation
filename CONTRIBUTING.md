# Contributing Guide

Thank you for investing your time in contribution to the dokieli Web Annotation
project!

The [dokieli/web-annotation](https://github.com/dokieli/web-annotation) repository contains the source code, which was originally derived from the [dokieli](https://dokie.li/) project.

## How to contribute

We welcome contributions in the form of issues or PRs.

## Code of conduct

We have a [Code of Conduct](CODE-OF-CONDUCT.md) to help keep our community
inclusive, welcoming, and friendly.

See [additional
resources](https://www.w3.org/about/positive-work-environment/#Education) for
education and training to promote a positive work environment.

## Licensing

Contributions are made in a personal capacity. By contributing, you represent that you have the right to submit the work under:

* Source code is licensed under the [Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0).
* Unless otherwise noted, resources such as images and other media assets are licensed under the [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).

## Quality Assurance

This project follows a set of quality assurance principles to ensure code, translations, accessibility, and security meet expectations.

**Code**: There is documentation for [tests](#tests). Code contributions are expected to be ultimately authored by humans, even if automated tools assist.

**Security**: This project has a [Security Policy](SECURITY.md).

**Standards**: This project is committed to implementing recognised web standards and best practises.

## Development

* See [API docs](docs.md).
* See [fork a repo](https://help.github.com/articles/fork-a-repo/) to setup
your own development repository and stay
[synchronised](https://help.github.com/articles/syncing-a-fork). Useful later
to make pull requests. For example, using your fork at `https://github.com/YOUR-USERNAME/web-annotation` :

Clone your work repository, for example:

```sh
git clone git@github.com:YOUR-USERNAME/web-annotation
cd web-annotation
```

Install packages:

```sh
yarn
```

Make your code updates at src/ , media/ etc.

Build eg. to create scripts/dokieli.js:

```sh
yarn build
```

or automatically rebuild when files change:

```sh
yarn watch
```

or create a minified scripts/dokieli.js:

```sh
yarn minify
```

To serve static files, you can use any HTTP server, e.g.:

```sh
npx serve
```

## Tests

### Unit tests

This project uses [Vitest](https://vitest.dev/) for unit tests.

To run unit tests, run:

```sh
yarn test
```

## Commits

We use [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): description`.

Common types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`. Example:

```text
feat(selectors): add Range Selector support
```
