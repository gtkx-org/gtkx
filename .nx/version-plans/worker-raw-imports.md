---
__default__: patch
---

Node workers can import project files with `?raw` under `gtkx dev` and Vitest, as they already could in `gtkx build`. The import provides the file's text instead of failing with `ERR_UNKNOWN_FILE_EXTENSION`.
