---
__default__: patch
---

Reference pages now mark props such as `label` and `action` on `<GMenuItem>`, `accelerator` on `<GtkShortcutTrigger>` and `requestMode` on `<GtkCustomLayout>` as construct-only. Changing them on a mounted element has always required a new `key`, but the generated reference listed them like ordinary props.
