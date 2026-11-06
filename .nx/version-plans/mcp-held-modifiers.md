---
__default__: patch
---

`gtkx_press_keys` now says when it leaves a modifier such as `{Control>}` held for later calls and names the keys that release it, and `gtkx_type` refuses to type while one is held. An agent that pressed `{Control>}{End}` and then typed used to run Control shortcuts instead of entering text, so `a` selected the whole document and the next typed text replaced it, while the tool answered "Typed text".
