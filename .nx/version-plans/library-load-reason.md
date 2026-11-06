---
__default__: patch
---

A GIR library that the dynamic linker cannot load now fails with the linker's reason, such as `cannot open shared object file: No such file or directory`, instead of a bare `dlopen failed` that repeated the library name. The Configuration guide explains how a library built alongside the app is found at run time.
