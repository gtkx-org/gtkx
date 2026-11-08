---
__default__: minor
---

A prop an element does not have now throws, naming the closest prop it does have: `<GtkLabel lable="…">` fails with "Did you mean 'label'?" instead of being ignored. A misplaced child or a prop named after a widget method, such as `packStart={…}`, fails with the prop to use, and development builds warn when an element that shows one child holds several visible children. A custom element behavior must return the props it handles from `update`.
