---
__default__: patch
---

Storybook controls respect `argTypes.if`: a control whose arg or global condition is false is hidden, and its argument stays unset in the preview, as in Storybook. Previously every conditional control was always shown and its argument always passed to the story.
