---
__default__: patch
---

Story controls with an `argTypes` `mapping` now pass the mapped value to the story in `gtkx storybook`. Selecting an option such as `large` in `{ control: "select", options: ["small", "large"], mapping: { small: 24, large: 96 } }` used to hand the option name itself to the component, which failed the preview for numeric or enum props.
