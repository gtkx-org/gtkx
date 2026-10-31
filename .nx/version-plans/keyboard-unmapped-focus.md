---
__default__: patch
---

`userEvent.keyboard` without a target and `gtkx_press_keys` without a widget ID now send the keys to the active window when its focus is on a widget that is no longer on screen, such as the close button of a tab that was just closed, so window shortcuts still run as they do on a keyboard. They used to fail because the focused widget was not mapped.
