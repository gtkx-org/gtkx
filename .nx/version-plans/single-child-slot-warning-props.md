---
__default__: patch
---

The development warning for a single-child element given several visible children now names the props that take the extra children, such as `sidebar={<AdwNavigationPage />}` for two pages given as `AdwNavigationSplitView` children, and no longer suggests wrapping them in a `GtkBox` where the element accepts only a specific child type.
