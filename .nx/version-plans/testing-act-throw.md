---
__default__: patch
---

A callback that throws inside `act`, `fireEvent` or a `userEvent` interaction no longer stops React from rendering later updates. Previously, after one failed interaction, state updates made outside `act`, such as a timer in a `gtkx dev` app driven through MCP, were never applied.
