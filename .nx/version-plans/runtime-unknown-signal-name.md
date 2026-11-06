---
__default__: patch
---

Emitting or connecting a signal the object does not have now names the signal and the object's type, for example `emitSignal: unknown signal 'clicked' on GtkLabel` when `fireEvent` or the MCP `gtkx_fire_event` tool targets a button's label instead of the button.
