---
__default__: patch
---

When the application quits, `gtkx dev` now lets pending work finish for a few seconds and, if the process is still running then, warns with the kinds of work keeping it alive, such as `Timeout`, before stopping. A built application with a module-level timer or an unanswered request keeps running without a window, as Node programs do; the Async Operations guide and the Create a Window chapter show how to end that work on unmount.
