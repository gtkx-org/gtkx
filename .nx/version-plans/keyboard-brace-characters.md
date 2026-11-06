---
__default__: patch
---

`userEvent.keyboard` and `userEvent.type` accept a single character in braces, as Testing Library does, so `{=}` presses the equals key and `{a>}` holds the A key until `{/a}`. These used to throw `Unknown key`.
