---
__default__: patch
---

Rendering `AdwApplicationWindow` or `GtkApplicationWindow` outside an application element, for example a window component rendered alone in a test, now explains that the window needs an application element such as `AdwApplication`. It previously reported `useApplication must be called within an application element`, naming a hook the application never called.
