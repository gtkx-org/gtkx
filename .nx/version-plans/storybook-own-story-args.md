---
__default__: patch
---

`composeStories` now types a story that declares its own args type, such as `StoryObj<{ count: number }>` with a custom `render`, with those args instead of leaving it out of the result, matching Storybook's `composeStories`.
