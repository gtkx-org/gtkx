---
__default__: patch
---

`agents.rules: false` now removes the GTKX section that codegen wrote to `AGENTS.md`, deleting `AGENTS.md` and the `CLAUDE.md` import when nothing else remains in them. The section used to stay behind unmaintained, still pointing agents at a reference that `agents.reference: false` had removed.
