---
__default__: major
---

Keep closures, pointer-valued properties, regex match subjects, and temporary native data alive for their required lifetimes, releasing them safely when no longer needed.

Remove generated `GObject.Closure.sink()` and `GObject.ParamSpec.sink()` methods as part of the GTKX 2 ownership model. Delete these manual calls; native handles manage reference sinking and release automatically.
