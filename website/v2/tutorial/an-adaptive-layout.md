---
description: "Collapse the sidebar and task list into one pane on narrow windows."
---

# Adapt the Layout

The [sidebar and task list](/v2/tutorial/lists-and-the-sidebar) fit beside each other in a wide window. At the minimum width of 360 logical pixels, they need to share one pane. Give the split view navigator a breakpoint condition so it collapses the panes and handles moving between them.

## Collapse below a breakpoint

In `src/components/window.tsx`, pass `collapseCondition` to `Split.Navigator`:

```diff [src/components/window.tsx]
@@ -16,0 +17 @@
+                    collapseCondition="max-width: 500sp"
```

The panes collapse while the condition holds and return side by side when the window grows again. The navigator measures the condition against its own size, which here is the whole window. libadwaita applies it while it lays out the window, as it does for an `AdwBreakpoint`, so the navigator changes layout before GTK moves keyboard focus. The window's `widthRequest` and `heightRequest` set the smallest size the collapsed layout must fit.

The condition uses the [`Adw.BreakpointCondition` syntax](https://gnome.pages.gitlab.gnome.org/libadwaita/doc/main/type_func.BreakpointCondition.parse.html). It is parsed at runtime, so TypeScript cannot catch a malformed condition string.

Use `sp` for the threshold so it grows with the text scale. At the default text size, `500sp` equals `500px`; with the standard Large Text setting it equals `625px`. See [Adwaita's length units](https://gnome.pages.gitlab.gnome.org/libadwaita/doc/main/enum.LengthUnit.html).

Here `px` means logical window coordinates, not physical display pixels. GTK maps window coordinates to device pixels using the [display scale](https://docs.gtk.org/gtk4/method.Widget.get_scale_factor.html). A threshold in `px` follows display scaling but does not grow with the text scale.

Keep the selected page in navigation state. The navigator handles the back button, keyboard navigation, and swipe gestures without a separate selected-pane field.

## Fill the empty content pane

In a collapsed window, going back from the task list returns to the sidebar and empties the content stack. Widening the window then leaves an empty content pane. Use `contentPlaceholder` to explain what to do next.

Above `Window`, add `NothingSelected`:

```diff [src/components/window.tsx]
@@ -1 +1 @@
-import { AdwApplicationWindow } from "@gtkx/jsx/adw";
+import { AdwApplicationWindow, AdwStatusPage } from "@gtkx/jsx/adw";
@@ -7,0 +8,8 @@
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
@@ -28,0 +29 @@
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
