---
__default__: patch
---

The Storybook explorer now leaves out stories without the `dev` tag, so `tags: ["!dev"]` hides a story from the navigator as it does in Storybook. `composeStories` still returns those stories.
