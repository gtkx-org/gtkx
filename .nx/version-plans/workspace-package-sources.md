---
__default__: patch
---

An app now treats the sources of the workspace packages it uses (linked from outside `node_modules` and depending on `@gtkx/react` or `@gtkx/i18n`) as its own. Codegen, `gtkx dev`, builds and deploys extract their `t()` messages into the app's gettext template, `POTFILES.in` and translation types, with locations relative to the app; declare their `?icon=<name>`, `?resource=<path>` and GSettings schema imports in the app's `env.d.ts`; and bundle and install their schemas. Before, a shared component package that called `t()` or imported an icon by name failed the app's `tsc`, its messages could never be translated, and building an app whose shared package imported a schema stopped with "it is outside" the project. `gtkx dev` also updates the template when such a package's file is saved.
