---
description: "Add smart views, a native filter control, and a search bar to the task list."
---

# Filter and Search Tasks

The split view now adapts to a narrow window. Add All Tasks, Today, Important, and Trash to its sidebar, then filter and search the selected view.

## Extend the selection

In `src/types.ts`, replace `Selection` and add `SmartView` and `Filter`:

```diff [src/types.ts]
@@ -21 +21,7 @@
-export type Selection = { kind: "list"; listId: string };
+export type SmartView = "all" | "today" | "important" | "trash";
+
+export type Selection =
+    | { kind: "smart"; view: SmartView }
+    | { kind: "list"; listId: string };
+
+export type Filter = "all" | "open" | "done";
```

`Selection` remains the `Tasks` route's param type. A smart view combines tasks from any list.

## Derive the visible tasks

Create `src/format.ts` for the shared date helper:

<<< @/figures/tutorial/smart-views-and-search/src/format.ts [src/format.ts]

Create `src/store/selectors.ts`:

<<< @/figures/tutorial/smart-views-and-search/src/store/selectors.ts [src/store/selectors.ts]

Trash includes deleted tasks; the other views exclude them. Sidebar badges count open tasks, except Trash, which counts everything it contains. New tasks created from a smart view go into the first list.

Components will select the stored arrays and derive their visible rows during render. For other selector patterns, see [Zustand's guide](https://zustand.docs.pmnd.rs/learn/guides/prevent-rerenders-with-use-shallow).

## Add the filter and search state

Create `src/store/ui.ts`:

<<< @/figures/tutorial/smart-views-and-search/src/store/ui.ts [src/store/ui.ts]

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

Keep `PersistedState` and `partialize` unchanged, so the filter and search start fresh on each launch. Choosing a sidebar entry calls `resetSearch` before navigating.

## Update the sidebar

Replace `src/components/sidebar.tsx` with:

<<< @/figures/tutorial/smart-views-and-search/src/components/sidebar.tsx [src/components/sidebar.tsx]

Each row carries the selection it opens. `selectedIndex` continues to follow the route, now comparing selection keys instead of list IDs. Empty badges are omitted.

In `src/navigation.ts`, add the launch selection:

```diff [src/navigation.ts]
@@ -20,0 +21,2 @@
+
+export const ALL_TASKS: Selection = { kind: "smart", view: "all" };
```

In `src/components/window.tsx`, import it and the title helper:

```diff [src/components/window.tsx]
@@ -4 +4,2 @@
-import { Split } from "../navigation.js";
+import { ALL_TASKS, Split } from "../navigation.js";
+import { selectionTitle } from "../store/selectors.js";
```

Use `initialParams={ALL_TASKS}` on the `Tasks` screen. Its title now comes from `selectionTitle(route.params, lists)`; the complete options appear below.

## Add the filter and search controls

A control can be a component with its own store subscription. Create `src/components/task-filter.tsx`:

<<< @/figures/tutorial/smart-views-and-search/src/components/task-filter.tsx [src/components/task-filter.tsx]

GTKX's notify props receive the property value first. The native toggle name is a nullable string, so the handler accepts only the app's three filter names.

Create `src/components/search-button.tsx`:

<<< @/figures/tutorial/smart-views-and-search/src/components/search-button.tsx [src/components/search-button.tsx]

The shortcut in the tooltip is added in [Add Menus and Shortcuts](/v2/tutorial/actions-menus-shortcuts).

In `src/components/window.tsx`, import the search button:

```diff [src/components/window.tsx]
@@ -0,0 +1 @@
+import { SearchButton } from "./search-button.js";
```

Replace the `Tasks` screen declaration with:

```diff [src/components/window.tsx]
@@ -46 +46 @@
-                        initialParams={{ kind: "list", listId: "personal" }}
+                        initialParams={ALL_TASKS}
@@ -48,4 +48,2 @@
-                            title:
-                                lists.find(
-                                    (list) => list.id === route.params.listId,
-                                )?.name ?? "Tasks",
+                            title: selectionTitle(route.params, lists),
+                            headerStart: <SearchButton />,
```

The filter goes above the list rather than in the header. A collapsed header already holds the back button, the page title and the window controls, and later chapters add more buttons, so the header must still fit the window's 360-pixel minimum width.

## Render search and empty states

Replace `src/components/task-list.tsx` with:

<<< @/figures/tutorial/smart-views-and-search/src/components/task-list.tsx [src/components/task-list.tsx]

`GtkSearchBar` owns the search entry and handles dismissal with Escape. Its notify handler updates the store when search closes. `GtkSearchEntry.onSearchChanged` reports edits after the native search delay.

`AdwStatusPage.description` accepts Pango markup. Escape the generated message with GLib's `markupEscapeText` so queries containing `&`, `<`, or markup tags appear literally. The add row stays available when no tasks match.

Replace `src/components/tasks-screen.tsx` with:

<<< @/figures/tutorial/smart-views-and-search/src/components/tasks-screen.tsx [src/components/tasks-screen.tsx]

Changing the selection remounts the native list, clearing its scroll position and unfinished add-row text. React explains [state reset through keys](https://react.dev/learn/preserving-and-resetting-state).

## Run it

Save the files and restart the app to see All Tasks as the launch view.

<figure class="result">
    <img class="result-light" src="/figures/tutorial-smart-views-and-search-light.png" width="720" height="480" loading="lazy" alt="The Tasks window with a sidebar of All Tasks 3, Today 1, Important 1, Personal 2, Work 1, Shopping, and Trash, with All Tasks selected. The content pane, titled All Tasks with a search button, shows the All, Open, and Done filter above the Add a task… entry and the rows Welcome to Tasks, Water the plants, and Prepare the weekly report." />
    <img class="result-dark" src="/figures/tutorial-smart-views-and-search-dark.png" width="720" height="480" loading="lazy" alt="The Tasks window with a sidebar of All Tasks 3, Today 1, Important 1, Personal 2, Work 1, Shopping, and Trash, with All Tasks selected. The content pane, titled All Tasks with a search button, shows the All, Open, and Done filter above the Add a task… entry and the rows Welcome to Tasks, Water the plants, and Prepare the weekly report." />
    <figcaption>Captured from <a href="#update-the-sidebar"><code>src/components/sidebar.tsx</code></a> and <a href="#render-search-and-empty-states"><code>src/components/task-list.tsx</code></a> above, with the window enlarged.</figcaption>
</figure>

- Complete an open task and check the sidebar counts.
- Select Today, Important, and Trash. Each shows tasks matching that view.
- Switch the filter above the list between All, Open, and Done.
- Search for `report`, then `<b>missing</b> & café`. The empty-state message should show the second query literally.
- Choose another sidebar entry. Its handler clears the query and closes the search bar.

Quit and restart once more. Tasks are preserved; the filter returns to All and search is closed.

## Next

Continue to [Edit Tasks](/v2/tutorial/the-task-editor).
