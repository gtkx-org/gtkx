---
__default__: patch
---

`gtkx_click` on the label inside a check button or a popover menu item no longer answers that nothing handled the click. The check button toggled and the menu item ran its action, but the result told the agent to press {Space} or {Enter} as well, which would toggle or run the action a second time.
