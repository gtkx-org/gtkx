---
__default__: minor
---

A prop that an element does not have now throws, naming the element and, where possible, the closest prop it does have: `<GtkLabel lable="…">` fails with "Did you mean 'label'?", and `margin_top` points to `marginTop`. Such props, including element-valued ones like a mistyped `titelWidget={<GtkLabel />}`, used to be written onto the native object as plain JavaScript properties and ignored silently. A custom element behavior must return the props it handles from `update`.
