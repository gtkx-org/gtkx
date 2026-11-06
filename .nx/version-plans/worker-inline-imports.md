---
__default__: patch
---

Workers can import files with `?inline` during `gtkx dev` and Vitest, as `gtkx build` already allowed. The import provides a `data:` URL of the file, where a worker used to fail to start with `ERR_UNKNOWN_FILE_EXTENSION`.
