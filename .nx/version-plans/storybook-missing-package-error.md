---
__default__: patch
---

`gtkx storybook` in a project without `@gtkx/storybook` now says the package is not installed and that it belongs next to `@gtkx/cli` as a development dependency, before generating bindings. It used to fail with `Cannot find module '@gtkx/storybook/package.json'` and a require stack.
