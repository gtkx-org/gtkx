---
__default__: patch
---

Saving a module that registers a GObject type with `registerClass`, or a module it imports, now restarts the app in `gtkx dev` and `gtkx storybook` so the edited class takes effect. Previously the save failed with `Type name '...' is already registered`, and the app kept failing on later saves, or Storybook kept the affected stories missing, until the session was restarted by hand.
