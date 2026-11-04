---
__default__: patch
---

`userEvent.keyboard` with a widget and `gtkx_press_keys` with a `widgetId` now focus that widget first when it can take focus and the window's focus is elsewhere, as a user would before typing. `{Space}` or `{Enter}` on a switch, check button or switch row then toggles it, instead of activating whichever widget the window had focused and reporting the keys as handled. An entry that passes its focus to its text, such as a search entry or spin button, takes the focus there, as a click would. A widget that cannot take focus, such as the switch inside a switch row, keeps the window's focus where it is; `gtkx_press_keys` then says that keys went to the focused widget instead and names the widget ID of the nearest ancestor that can take focus.
