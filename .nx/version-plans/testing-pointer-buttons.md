---
__default__: patch
---

`userEvent.pointer` now takes Testing Library's `[MouseRight]` and `[MouseMiddle]` tokens, with `>` to press and a leading `/` to release, so tests can open a context menu that a `GtkGestureClick` with `button={Gdk.BUTTON_SECONDARY}` shows. The handlers see that button from `getCurrentButton()`. An unknown token such as `[MouseBack]` now fails with an error listing the accepted ones instead of doing nothing.
