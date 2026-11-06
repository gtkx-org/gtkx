---
__default__: patch
---

`gtkx dev` now restarts the application when Fast Refresh remounts the component that renders `AdwApplication`, for example after adding a hook to it. The window used to disappear after GLib reported `Failed to register`, leaving the dev server running with no application.
