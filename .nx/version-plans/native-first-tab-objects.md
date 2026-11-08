---
__default__: major
---

`flushSync` is removed from `@gtkx/react` and `createTabCollection` from `@gtkx/components`. Handlers that must return a native object synchronously, such as `create-tab` and `create-window`, create it first and render into it with `createPortal`, and the new tab view navigator covers tabs across windows.
