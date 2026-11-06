---
__default__: patch
---

`gtkx dev`, `gtkx build` and `gtkx deploy` now reject an entry that is not a JavaScript or TypeScript module, and the error shows how to pass the file to the application after `--`, including the extra `--` that `npm run` needs. A document passed as `npm run dev -- notes.txt` used to be loaded as the entry module and fail with a parse error while the dev server waited for a change. `gtkx dev --help` now mentions application arguments.
