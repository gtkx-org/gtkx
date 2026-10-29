---
__default__: patch
---

`?resource` imports now bundle files of any type, such as `import welcomePath from "../data/welcome.txt?resource"` or a JSON, CSS or shader file, instead of failing with an error that told you to use `?resource`.
