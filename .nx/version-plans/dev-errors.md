---
__default__: patch
---

`gtkx dev` reports an error thrown while the app starts and keeps the dev server up, ends the app on an uncaught exception as a built app would, and points stack traces at the right source line. When the app quits with pending work, it warns what keeps the process alive. It stops with status 1 when another process owns the application ID, and prints fewer duplicate errors and Vite messages that do not apply.
