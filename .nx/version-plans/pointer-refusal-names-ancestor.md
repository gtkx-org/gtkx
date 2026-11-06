---
__default__: patch
---

When `userEvent.click` or another pointer helper refuses a widget inside one whose `can-target` property is off, such as the title of an `AdwTabOverview` thumbnail, the error now names the nearest ancestor a pointer would land on, and `gtkx_click` adds that ancestor's widget ID, so a test or an agent can click it instead.
