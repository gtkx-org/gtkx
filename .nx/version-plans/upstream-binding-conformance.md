---
__default__: minor
---

Support container in/out parameters, nested string arrays, caller-allocated variable arrays, record inputs by value, scalar and opaque pointer arguments, callback properties, and Cairo path copies. Preserve floating-object references, native property and signal types, static vfunc arguments, and collection ownership. Exercise both upstream marshalling and regression GIRs under ASan with per-test leak checks and a gate for generated API execution.
