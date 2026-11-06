---
__default__: patch
---

`gtkx deploy --skip-build` stops when `dist/` was built from another entry than the application's, such as a helper built without `--out`, instead of packaging it as the application. Builds now record their entry in `dist/gtkx-schemas.json`; run `gtkx build` again before the next `--skip-build`.
