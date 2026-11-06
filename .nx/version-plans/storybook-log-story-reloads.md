---
__default__: patch
---

`gtkx storybook` now logs `File changed` and `Stories reloaded` when a save reloads the stories, such as an edit to a story file or to a module a story imports that is not a component. Those saves used to apply without any output, unlike component edits, which log their Fast Refresh.
