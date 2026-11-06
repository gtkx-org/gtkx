---
__default__: patch
---

A failing `toBeVisible` now says what hides the widget: that it or a named ancestor is hidden, or has opacity 0. A widget still fading in under `areAnimationsEnabled: true` used to fail with only "expected widget to be visible", although its own `visible` property was true.
