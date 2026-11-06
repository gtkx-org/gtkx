---
__default__: patch
---

JavaScript projects from `create-gtkx` now list `@types/react`, the peer dependency `@gtkx/react` declares. Yarn does not install missing peers, so `gtkx codegen` in a Yarn JavaScript project failed to generate the element reference with `Could not find a declaration file for module 'react'`.
