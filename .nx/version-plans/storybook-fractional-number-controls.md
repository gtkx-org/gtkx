---
__default__: patch
---

Storybook number controls now show fractional arguments, such as `0.03`, when the control declares no fractional `step`. Previously the control displayed `0`, and committing the field replaced the argument with the rounded value.
