---
__default__: patch
---

`userEvent.click` and MCP `gtkx_click` on a label inside a header bar, such as its title, no longer fail with `Gdk-CRITICAL: gdk_display_device_is_grabbed: assertion 'GDK_IS_DEVICE (device)' failed`. The click no longer reaches the window handle's drag and maximize gesture, which needs a real pointer device, so it does nothing, as clicking a title does.
