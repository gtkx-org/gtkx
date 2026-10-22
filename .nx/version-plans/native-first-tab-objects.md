---
__default__: major
---

Remove `flushSync` from `@gtkx/react` and `createTabCollection` from `@gtkx/components`. Handlers that must return a native object synchronously, such as `create-tab` and `create-window`, create it first and render into it with `createPortal`; the tab view navigator covers tabs across windows.
