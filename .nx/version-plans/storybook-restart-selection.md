---
__default__: patch
---

`gtkx storybook` now reopens the story you were viewing when it restarts its runner, such as after a configuration change or a new GIR import, instead of returning to the first story. A new `gtkx storybook` session still starts on the first story.
