---
__default__: patch
---

Removing a prop restores its default even when GIR records none, equal new values for construct-only props no longer throw, and replacing a native object prop or a slot's element keeps the parent's other props and user changes. `onNotify…` handlers hear changes caused by adding or removing children and receive values typed like the getter, and `AdwAlertDialog` responses update in place. A `<Suspense>` boundary inside a single-child element shows its content again after the fallback.
