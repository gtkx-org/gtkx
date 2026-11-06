---
__default__: patch
---

A window element mounted with `visible={false}` now stays hidden until `visible` becomes `true`. It used to be presented on mount regardless, so a hidden welcome or `hideOnClose` window appeared at startup.
