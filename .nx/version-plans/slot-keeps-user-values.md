---
__default__: patch
---

Replacing the element in a slot no longer resets the parent's other props to their JSX values. A `GtkPaned` with `position={200}` used to snap its divider back whenever its `endChild` switched to a different element, such as from an empty state to a detail view, undoing the user's drag. Props that the new child does change, such as a drop-down's `selected` after a new model, are still restored.
