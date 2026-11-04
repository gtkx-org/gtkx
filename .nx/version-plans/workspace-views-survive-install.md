---
__default__: patch
---

An app in an npm workspace now keeps its view of the shared bindings across `npm install`. Codegen writes the view to the app's `node_modules/.gtkx/gi` and `.gtkx/jsx`, which package managers leave alone, and links `@gtkx/gi` and `@gtkx/jsx` to it, so `tsc` and editors resolve `@gtkx/gi` and `@gtkx/jsx` imports through the scaffold's `tsconfig.json` paths without rerunning codegen. They used to report every such import missing after an install until `gtkx codegen`, `gtkx dev` or Vitest ran again.
