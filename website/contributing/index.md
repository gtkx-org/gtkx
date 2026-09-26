---
title: Contributing
description: "Set up the GTKX repository, locate the code for a change, and check your contribution."
---

# Contributing

Start with [Development Setup](/contributing/development) to build GTKX and run an example. Read the [Development Principles](/contributing/principles) for package boundaries, coding standards, and testing policy.

This section follows `main` and is shared across documentation versions. To build an application, use the versioned [Guide](/v2/guide/why-gtkx) or [Tutorial](/v2/tutorial/).

## Get oriented

| Task | Start here |
| --- | --- |
| Find the layer responsible for a bug | [Architecture](/contributing/architecture#finding-the-responsible-layer) |
| Find a package or dependency | [Tech Stack](/contributing/tech-stack) |
| Change generated bindings or JSX | [Code Generation](/contributing/code-generation) |
| Investigate calls, ownership, callbacks, or the event loop | [Native Runtime](/contributing/native-runtime) |
| Change props, child placement, signals, or presentation | [React Renderer](/contributing/react-renderer) |
| Choose and run checks | [Testing](/contributing/testing) |
| Edit the website or promote documentation | [Maintaining Documentation](/contributing/documentation) |
| Prepare and publish a release | [Publishing Releases](/contributing/releases) |

## Find the right place to contribute

A widget failure may begin in generated metadata or native ownership. The architecture pages trace these paths and link to their source. Runnable applications live in `examples/`; prose and website components live in `website/`.

## Work with the project

Use [issues](https://github.com/gtkx-org/gtkx/issues) for bugs and [Discussions](https://github.com/gtkx-org/gtkx/discussions) for questions and design conversations. Follow the [contribution guide](https://github.com/gtkx-org/gtkx/blob/main/CONTRIBUTING.md) when submitting a change.

Participation follows the [Code of Conduct](https://github.com/gtkx-org/gtkx/blob/main/CODE_OF_CONDUCT.md). Report vulnerabilities privately through the [security policy](https://github.com/gtkx-org/gtkx/blob/main/SECURITY.md).
