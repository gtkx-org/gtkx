---
__default__: patch
---

An exception thrown from a callback that GLib runs from the main loop, such as a `GLib.idleAdd` or `GLib.timeoutAdd` source or the ready or progress handler of an asynchronous GIO call, no longer stops the other callbacks GLib dispatches in the same main loop iteration. An application with its own `uncaughtException` listener used to lose them silently: their sources were removed without running and the promises of asynchronous calls finishing at the same time never settled. Each failure now reaches the listener as soon as its callback returns, and the remaining callbacks run.
