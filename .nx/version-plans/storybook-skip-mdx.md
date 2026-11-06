---
__default__: patch
---

`gtkx storybook` now skips `.mdx` files matched by the `stories` patterns and prints one warning naming them, instead of reporting a parse error for each file. A Storybook configuration that lists MDX documentation pages works unchanged.
