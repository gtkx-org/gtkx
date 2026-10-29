---
__default__: patch
---

Saving a module that registers a GObject type with `registerClass`, or a module it imports, now restarts the app in `gtkx dev` so the edited class takes effect. Previously the save failed with `Type name '...' is already registered`, and later saves kept failing until `gtkx dev` was restarted by hand.
