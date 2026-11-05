---
__default__: patch
---

When `gtkx dev` restarts because an edited component module also exports something that is not a component, it now names that export and suggests moving it, instead of restarting without a reason.
