---
__default__: patch
---

Evaluating `@gtkx/runtime` a second time in one process now throws an error that names `vi.resetModules()`. A test that called `vi.resetModules()` and imported the app again used to load a second copy of GTKX whose widgets partly worked, then failed with an unrelated error such as `connectSignal: unknown signal`. The Testing guide shows how to keep module-level state behind a function or a prop instead.
