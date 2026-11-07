---
__default__: patch
---

The split view navigator's sidebar toolbar now passes its header bar through `AdwToolbarView`'s `top` slot instead of the deprecated `topBar` prop, so it keeps working when `topBar` is removed.
