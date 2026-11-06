---
__default__: patch
---

`gtkx dev` now ends the application on an uncaught exception, such as an error thrown from a signal handler, a draw function or a `GLib.timeoutAdd` callback, as Node ends a built application, and starts it again on the next save. It used to print the error and keep the application running, so a crash that ends the shipped app went unnoticed in development. An application's own `uncaughtException` listener keeps it running in both, and the Error Handling guide now describes these exceptions.
