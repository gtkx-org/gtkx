---
__default__: patch
---

`gtkx build --out` now rejects a directory inside the deploy output directory (`build/` by default). The next `gtkx deploy` used to delete a helper build placed there without a word, or refuse to deploy when the helper was built first. The Assets guide's helper example now builds into `dist-helper`.
