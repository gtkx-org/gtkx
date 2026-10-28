---
__default__: minor
---

Node workers can import project files with `?url` under `gtkx dev` and Vitest, as they already could in `gtkx build`. The import provides the source file's path, as it does on the main thread during development, instead of failing with `ERR_UNKNOWN_FILE_EXTENSION`.
