---
__default__: patch
---

The `style` prop's type now accepts CSS custom properties such as `"--accent-bg-color"`, at the top level and in nested `&` blocks, so a widget can set a variable that it and its descendants read through `var()`. GTK applied them already, but TypeScript rejected the keys.
