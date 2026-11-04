---
__default__: patch
---

`userEvent.keyboard` with a widget and `gtkx_press_keys` with a `widgetId` now focus that widget first when it can take focus and the window's focus is elsewhere, as a user would before typing. `{Space}` or `{Enter}` on a switch, check button or switch row then toggles it, instead of activating whichever widget the window had focused and reporting the keys as handled.
