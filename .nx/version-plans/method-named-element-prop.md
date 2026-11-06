---
__default__: patch
---

Passing an element under a widget method's name, such as a port's `packStart={<GtkButton />}` on `<AdwHeaderBar>`, now fails with an error that names the prop to use, for example `start={<GtkButton />}`. It used to be ignored silently and replaced the instance's `packStart` method, so correcting the prop to `start` during Fast Refresh failed with `parent[method] is not a function`.
