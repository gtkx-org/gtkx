---
__default__: minor
---

Add `createTabViewNavigator` to `@gtkx/navigation`. It keeps the pages of an `Adw.TabView` in navigation state: open, close, select, reorder and pin tabs through actions, navigate to a tab by name or `getId`, follow tab bar and overview interaction, open related tabs after their parent, mount screens lazily, and adopt pages dragged in from another window. `useTabView` exposes the native view to screens and header content.
