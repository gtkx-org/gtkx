---
__default__: patch
---

A value a `registerClass` vfunc returns that its native caller cannot take, such as a fractional size from `vfuncMeasure`, now fails with an error naming the class and vfunc that returned it. The error used to give only the conversion's reason, with no frame of the app's code in its stack.
