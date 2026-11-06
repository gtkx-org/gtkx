---
__default__: patch
---

`@gtkx/testing` now prints widgets in snapshots as their widget tree, so `expect(container).toMatchSnapshot()` records the rendered widgets. Every widget used to serialize as an empty object such as `Window {}`, and snapshot tests passed whatever the component rendered.
