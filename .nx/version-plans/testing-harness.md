---
__default__: patch
---

`@gtkx/testing` cleanup quits the application a render started and releases held keys and buttons, and a test no longer fails when an error boundary catches an error. A throwing callback inside `act` no longer stops later renders, and `findBy*` queries accept wait options as a third argument. `render` without a container parents dialogs to the harness window, and loading `@gtkx/runtime` twice after `vi.resetModules()` throws an error that says so.
