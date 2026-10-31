---
__default__: patch
---

A `<GtkPopover>` placed inside a button or another single-child container now attaches to that widget instead of replacing its content or being left without a parent, and a popover rendered with `visible` already true opens once its window is on screen, after its content is in place. These used to crash the app with a segmentation fault when the popover opened, or close the popover as soon as it appeared.
