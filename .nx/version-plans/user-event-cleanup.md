---
__default__: patch
---

`@gtkx/testing` now releases the keyboard modifiers and pointer buttons the default `userEvent` still holds when a test is cleaned up. A test that ended with `{Shift>}` or `[MouseLeft>]` still pressed used to leave it held for the next test in the file, so that test's shortcuts saw an extra modifier and its first press was ignored.
