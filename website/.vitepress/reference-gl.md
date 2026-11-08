# @gtkx/gl

OpenGL 4.6 core bindings generated from the Khronos registry. Each command and constant maps to the C one of the same name, so the [Khronos OpenGL 4.6 reference](https://registry.khronos.org/OpenGL-Refpages/gl4/) documents its parameters and behavior.

## Names and types

- Commands drop the `gl` prefix and start in lowercase: `gl.clear` calls `glClear`.
- Constants drop `GL_`: `gl.COLOR_BUFFER_BIT` is `GL_COLOR_BUFFER_BIT`.
- Numeric GL types are `number`, except `GLint64` and `GLuint64`, which are `bigint`. `GLboolean` is `boolean`.

Your editor's completions list every exported binding. The OpenGL guide's [Use the bindings](/v2/guide/opengl#use-the-bindings) section covers singular helpers such as `gl.genBuffer`, typed arrays, and the commands that are not exported.

Only the info-log readers below differ from C: they read the whole log and return it as a string.
