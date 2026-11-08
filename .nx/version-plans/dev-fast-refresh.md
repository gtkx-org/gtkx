---
__default__: minor
---

`gtkx dev` keeps application state for more edits. Imported `.css` files and `injectGlobal` rules apply in the open window instead of restarting the app, and edits to non-component modules such as custom hooks, or to files imported with `?raw`, Fast Refresh the components that import them. An edited `injectGlobal` call adds its rules after the earlier ones, so a removed rule keeps applying until a restart.
