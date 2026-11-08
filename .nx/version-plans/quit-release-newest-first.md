---
__default__: patch
---

An app whose GtkSourceView completion provider keeps a completion context alive in JavaScript no longer logs two `gtk_text_buffer_delete_mark` criticals when it quits after the view is gone. GTKX released the objects only JavaScript still held in the order it first wrapped them, so the buffer went before the context created from it, and GtkSourceView's context disposal touched the buffer's deleted marks. At quit, objects other than widgets and instances of registered classes are now released newest first, so an object goes before the one it came from.
