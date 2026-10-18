# @gtkx/codegen

Generate TypeScript and JSX bindings from GObject Introspection data.

GTKX reads GObject Introspection Repository (GIR) files to generate `@gtkx/gi`, `@gtkx/jsx`, and the project widget reference. In applications, declare native libraries in `gtkx.config.ts` and run `npm run codegen`; direct use of the generator is intended for tooling.

Contributors can add library overrides in `overrides/<namespace>/overrides/`. See [Code Generation](https://gtkx.dev/contributing/code-generation) for the generation pipeline and override conventions.

[Guide](https://gtkx.dev/v2/guide/configuration-and-codegen) · [API reference](https://gtkx.dev/v2/reference/@gtkx/codegen/) · [GTKX](https://gtkx.dev)

**GTKX 2.0 beta.** Requires Linux, Node.js, and the [native prerequisites](https://gtkx.dev/v2/guide/getting-started).

[MPL-2.0](https://github.com/gtkx-org/gtkx/blob/main/LICENSE).
