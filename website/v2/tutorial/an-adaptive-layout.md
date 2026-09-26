---
description: "Collapse the sidebar and task list into one pane on narrow windows."
---

# Adapt the Layout

The [sidebar and task list](/v2/tutorial/lists-and-the-sidebar) fit beside each other in a wide window. At the minimum width of 360 logical pixels, they need to share one pane. Add a breakpoint that collapses the split view and lets the navigator handle moving between the panes.

## Store the collapse state

Create `src/store/ui.ts`:

```ts [src/store/ui.ts]
import type { StateCreator } from "zustand";
import type { Mutators, Store } from "./index.js";

export type UiSlice = {
    collapsed: boolean;
    setCollapsed: (collapsed: boolean) => void;
};

export const createUiSlice: StateCreator<Store, Mutators, [], UiSlice> = (set) => ({
    collapsed: false,
    setCollapsed: (collapsed) => set({ collapsed }),
});
```

Add the UI slice to `src/store/index.ts`:

```diff [src/store/index.ts]
@@ -6,0 +7 @@
+import { createUiSlice, type UiSlice } from "./ui.js";
@@ -8 +9 @@
-export type Store = TasksSlice & ListsSlice;
+export type Store = TasksSlice & ListsSlice & UiSlice;
@@ -20,0 +22 @@
+            ...createUiSlice(...a),
```

Keep `PersistedState` and `partialize` unchanged. The window's current size determines `collapsed` each time the app starts; it should not be restored from disk.

## Add the breakpoint

In `src/components/window.tsx`, read `collapsed` and `setCollapsed`. Add an `AdwBreakpoint` to the window's `breakpoints` slot:

```diff [src/components/window.tsx]
@@ -1 +1,2 @@
-import { AdwApplicationWindow } from "@gtkx/jsx/adw";
+import * as Adw from "@gtkx/gi/adw";
+import { AdwApplicationWindow, AdwBreakpoint } from "@gtkx/jsx/adw";
@@ -10,0 +12,2 @@
+    const collapsed = useStore((state) => state.collapsed);
+    const setCollapsed = useStore((state) => state.setCollapsed);
@@ -13 +16,13 @@
-        <AdwApplicationWindow title="Tasks" widthRequest={360} heightRequest={294} onCloseRequest={() => quit()}>
+        <AdwApplicationWindow
+            title="Tasks"
+            widthRequest={360}
+            heightRequest={294}
+            onCloseRequest={() => quit()}
+            breakpoints={
+                <AdwBreakpoint
+                    condition={Adw.BreakpointCondition.parse("max-width: 500sp")}
+                    onApply={() => setCollapsed(true)}
+                    onUnapply={() => setCollapsed(false)}
+                />
+            }
+        >
```

`onApply` sets `collapsed` when the condition becomes true; `onUnapply` clears it when the window grows again. `Adw.BreakpointCondition.parse` parses the condition at runtime, so TypeScript cannot catch a malformed condition string.

Use `sp` for the threshold so it grows with the text scale. At the default text size, `500sp` equals `500px`; with the standard Large Text setting it equals `625px`. See [Adwaita's length units](https://gnome.pages.gitlab.gnome.org/libadwaita/doc/main/enum.LengthUnit.html).

Here `px` means logical window coordinates, not physical display pixels. GTK maps window coordinates to device pixels using the [display scale](https://docs.gtk.org/gtk4/method.Widget.get_scale_factor.html). A threshold in `px` follows display scaling but does not grow with the text scale.

## Pass the state to the navigator

Still in `src/components/window.tsx`, pass the new value to `Split.Navigator`:

```diff [src/components/window.tsx]
@@ -31,0 +32 @@
+                    collapsed={collapsed}
```

The breakpoint updates the store; the navigator reads it to switch layouts. Keep the selected page in navigation state. The navigator handles the back button, keyboard navigation, and swipe gestures without a separate selected-pane field.

## Fill the empty content pane

In a collapsed window, going back from the task list returns to the sidebar and empties the content stack. Widening the window then leaves an empty content pane. Use `contentPlaceholder` to explain what to do next.

Above `Window`, add `NothingSelected`:

```diff [src/components/window.tsx]
@@ -2 +2 @@
-import { AdwApplicationWindow, AdwBreakpoint } from "@gtkx/jsx/adw";
+import { AdwApplicationWindow, AdwBreakpoint, AdwStatusPage } from "@gtkx/jsx/adw";
@@ -8,0 +9,8 @@
+
+const NothingSelected = () => (
+    <AdwStatusPage
+        iconName="view-list-symbolic"
+        title="Nothing Selected"
+        description="Pick a list or a smart view in the sidebar"
+    />
+);
```

Pass it to the navigator:

```diff [src/components/window.tsx]
@@ -43,0 +44 @@
+                    contentPlaceholder={<NothingSelected />}
```

When the content stack is empty, `useSelection` returns `null`. The sidebar's `lists.findIndex` then returns `-1`, which clears `selectedIndex`. GTKX suppresses the resulting `row-selected` signal when applying that prop, so clearing the highlight does not navigate again.

## Run it

1. Narrow the window past the `500sp` threshold. The task list appears alone with a back arrow because `initialRouteName="Tasks"` opens it at startup.
2. Go back to the sidebar. Select a list, then try the back arrow, <kbd>Escape</kbd>, <kbd>Alt</kbd> + <kbd>Left</kbd>, or a touchpad back gesture.
3. Return to the sidebar and widen the window. No row is selected, and the content pane shows **Nothing Selected**. Select a list to restore its tasks.
4. Enable Large Text in the desktop accessibility settings and resize again. The panes should collapse at a wider window size. Restore your preferred text size afterward.

## Next

[Filter and Search Tasks](/v2/tutorial/smart-views-and-search) adds All Tasks, Today, Important, and Trash.
