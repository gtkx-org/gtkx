---
__default__: patch
---

`gl.shaderSource` accepts `null` lengths, as `NULL` does in C, so each source is read to its end. The OpenGL guide now shows this form and explains why `[source.length]` truncates shaders that contain non-ASCII characters.
