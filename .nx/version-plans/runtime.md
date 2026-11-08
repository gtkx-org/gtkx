---
__default__: patch
---

An exception from a main-loop callback no longer drops the other callbacks GLib dispatches in the same iteration, and closing a GLib descriptor whose number Node reused no longer aborts the process. Adaptive windows no longer crash on quit, record field access no longer allocates on every read, and list views over JavaScript models tear down at quit without warnings.
