---
__default__: patch
---

Relative `url()` references and `@import` rules in an imported `.css` file now work in `gtkx dev`, Vitest and production builds: referenced images are bundled as GResource files and imported stylesheets are loaded before the file's rules. They used to resolve to nothing, so a `background-image: url("../data/paper.png")` silently drew no image.
