# @gtkx/codegen

Generate TypeScript and JSX bindings for GTK and GObject libraries.

Reads GObject Introspection Repository (GIR) files and generates the `@gtkx/gi` bindings, the `@gtkx/jsx` elements and their reference pages. Apps don't call it directly: declare additional native libraries in `gtkx.config.ts` and run `npm run codegen`. Its API serves GTKX tooling such as the CLI and the MCP server.

Contributors add library overrides in `overrides/<namespace>/overrides/`. [Code Generation](https://gtkx.dev/contributing/code-generation) describes the pipeline and the override conventions.

[Guide](https://gtkx.dev/v2/guide/configuration-and-codegen) · [API reference](https://gtkx.dev/v2/reference/@gtkx/codegen/) · [GTKX](https://gtkx.dev)

GTKX requires Linux, Node.js, and the [native prerequisites](https://gtkx.dev/v2/guide/getting-started#what-you-need).

[MPL-2.0](https://github.com/gtkx-org/gtkx/blob/main/LICENSE).
