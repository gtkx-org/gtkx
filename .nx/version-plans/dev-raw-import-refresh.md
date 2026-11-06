---
__default__: patch
---

Saving a file imported with `?raw`, such as a GLSL shader loaded with `import source from "./shader.glsl?raw"`, now Fast Refreshes the components that import it in `gtkx dev`. Previously the save failed with a parse error, or Fast Refresh was skipped because the edit never settled.
