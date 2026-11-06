---
__default__: patch
---

`findBy*` and `findAllBy*` queries accept Testing Library's wait options as a third argument, as in `screen.findByText("Saved", undefined, { timeout: 3000 })`, which used to fail type checking with "Expected 1-2 arguments". Wait options given with the query options still work; when both are given, the third argument wins. The Testing guide also says that `selectOptions` takes positions rather than option values.
