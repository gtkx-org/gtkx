---
__default__: patch
---

Static navigator configs typecheck when they use callbacks such as `screenOptions: ({ route }) => ...`, `options`, `listeners` or `getId`. Each `create*Navigator(config)` now returns the static navigator with `getComponent()` and `.with()` instead of failing with "not assignable to parameter of type 'undefined'".
