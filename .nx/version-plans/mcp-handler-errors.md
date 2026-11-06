---
__default__: patch
---

`gtkx dev` now reports an error an app's signal handler throws during an MCP interaction, such as a `gtkx_click` on a button whose `onClicked` throws, as it reports the same error from a real click. Such errors used to appear only in the tool result. Errors from using a tool on the wrong widget, such as typing into a button, still appear only in the tool result, and `fireEvent` now rejects a signal name the object does not have before emitting anything.
