---
__default__: patch
---

Passing something other than a native instance where GTKX expects one, such as a function for a widget prop or method argument, now throws a `TypeError` that names what was passed (`Expected a native instance, got function`), as GJS does, instead of `No native handle associated with Function`.
