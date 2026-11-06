---
__default__: patch
---

`getByLabelText` and the other label text queries find a `GtkLabel` by an `accessibleLabel` that differs from its text, as Testing Library finds an element by its `aria-label`, so `<GtkLabel accessibleLabel="Time remaining">25:00</GtkLabel>` is found by "Time remaining". A label still never matches its own text.
