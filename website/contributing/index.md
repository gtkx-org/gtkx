---
title: Contributing
description: "Understand GTKX's architecture, set up the development environment, and contribute to the framework."
---

# Contributing

GTKX brings React and TypeScript to the GNOME application platform. Contributing to the framework means working across generated bindings, a native Rust bridge, a React renderer, and the tools that make them usable together.

This section describes the repository on `main`, where GTKX 2.0 is being developed. It is shared across documentation versions and follows the codebase as it changes. For building an application, use the versioned [Guide](/v2/guide/why-gtkx) and [Tutorial](/v2/tutorial/).

The [Development Principles](/contributing/principles) define the required architecture and standards for changes. The implementation pages describe the code as it exists today and identify the boundaries to review against those principles.

## Get oriented

| Page | What it covers |
| --- | --- |
| [Development Setup](/contributing/development) | Prerequisites, building the workspace, running examples, and preparing a change. |
| [Tech Stack](/contributing/tech-stack) | Languages, native libraries, dependencies, tooling, and the workspace package map. |
| [Architecture](/contributing/architecture) | How the layers fit together, from GIR input to a running application. |
| [Code Generation](/contributing/code-generation) | Parsing introspection data and producing TypeScript bindings, JSX elements, and reference documentation. |
| [Native Runtime](/contributing/native-runtime) | Native calls, value conversion, object ownership, callbacks, and the shared event loop. |
| [React Renderer](/contributing/react-renderer) | Reconciliation, element configuration, child placement, properties, signals, and component lifecycles. |
| [Testing](/contributing/testing) | Running native integration tests, testing through widgets, and checking packaged applications. |
| [Development Principles](/contributing/principles) | Required package boundaries, simplicity, declarative composition, testing, and consumer-focused development. |

Start with the principles and architecture overview to understand the required boundaries and current implementation, then follow the setup instructions to run the code. Each technical page points to the source that implements the behavior it describes.

## Find the right place to contribute

Changes often cross package boundaries. A binding issue can start in GIR parsing or generation; a prop update can pass through generated class metadata, the renderer, the TypeScript runtime, and the Rust bridge. The architecture pages explain that path so you can locate the layer responsible before editing.

Documentation and examples are part of the project too. The website lives in `website/`, and the runnable applications in `examples/` demonstrate the public APIs. See [Development Setup](/contributing/development) for the corresponding commands.

## Work with the project

Use [issues](https://github.com/gtkx-org/gtkx/issues) to report bugs and [Discussions](https://github.com/gtkx-org/gtkx/discussions) for questions and design conversations. The repository's [contribution guide](https://github.com/gtkx-org/gtkx/blob/main/CONTRIBUTING.md) covers contribution and release procedures.

Participation follows the [Code of Conduct](https://github.com/gtkx-org/gtkx/blob/main/CODE_OF_CONDUCT.md). Report security vulnerabilities through the private channel in the [security policy](https://github.com/gtkx-org/gtkx/blob/main/SECURITY.md).
