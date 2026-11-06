---
__default__: patch
---

`userEvent.keyboard`, `userEvent.type` and `gtkx_press_keys` no longer print `gtk_im_context_filter_keypress: assertion 'key != NULL' failed` for each key in a `GtkSourceView`. Keys now skip GtkSourceView's own key controller, which needs a real key event, and behave as in a plain `GtkTextView`.
