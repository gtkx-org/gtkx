---
__default__: patch
---

Setting `agents.reference: false` now removes the generated `.gtkx/reference` and drops the rules' instruction to read it. Codegen previously stopped refreshing the reference but left the old pages in place, and the GTKX block in `AGENTS.md` still told agents to treat `.gtkx/reference/index.md` as the authority on props and methods, a file that went stale or, in a fresh checkout, did not exist.
