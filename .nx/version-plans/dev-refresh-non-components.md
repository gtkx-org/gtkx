---
__default__: minor
---

`gtkx dev` keeps application state when you edit a module that is not a component, such as a custom hook or a shared `css` module. Fast Refresh now re-runs the components that import it, directly or through other modules, instead of restarting the app. The app still restarts when an edit reaches the entry module before a component module.
