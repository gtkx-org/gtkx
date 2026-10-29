---
__default__: patch
---

`@gtkx/testing` no longer fails a test when an error boundary catches an error, as React Testing Library does, so a test can render and assert an error state. The caught error goes to the `onCaughtError` render option, or is logged. An error no boundary catches still fails the test, and a cleanup that fails for a single reason now rejects with that error instead of an `AggregateError`.
