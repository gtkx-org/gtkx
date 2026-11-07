---
description: "Organize tasks into lists and navigate between them with an Adwaita split view."
---

# Add Lists and a Sidebar

Your tasks now survive a restart. Add a sidebar for Personal, Work, and Shopping, with the selected list opening in the content pane.

## Add the lists

`Task` already has a `listId`. Add these two types to `src/types.ts`:

```diff [src/types.ts]
@@ -13,0 +14,8 @@
+
+export type TaskList = {
+    id: string;
+    name: string;
+    color: string;
+};
+
+export type Selection = { kind: "list"; listId: string };
```

In `src/store/seed.ts`, add `TaskList` to the existing type import and append the list defaults:

```diff [src/store/seed.ts]
@@ -1 +1 @@
-import type { Task } from "../types.js";
+import type { Task, TaskList } from "../types.js";
@@ -54,0 +55,6 @@
+
+export const seedLists: TaskList[] = [
+    { id: "personal", name: "Personal", color: "#3584e4" },
+    { id: "work", name: "Work", color: "#2ec27e" },
+    { id: "shopping", name: "Shopping", color: "#e66100" },
+];
```

Keep your existing `seedTasks`. Saved tasks take precedence over seed data, so changing that array would not add tasks to a list you have already saved. Shopping starts empty; you can add tasks to it through the app.

## Split the store

Separate tasks and lists using Zustand's [slices pattern](https://zustand.docs.pmnd.rs/learn/guides/slices-pattern). Persistence stays on the combined store.

Move the task state and actions into `src/store/tasks.ts`:

<<< @/figures/tutorial/lists-and-the-sidebar/src/store/tasks.ts [src/store/tasks.ts]

Create `src/store/lists.ts`:

<<< @/figures/tutorial/lists-and-the-sidebar/src/store/lists.ts [src/store/lists.ts]

The New List dialog will use `addList` in [Add Undo and Delete Confirmation](/v2/tutorial/trash-and-toasts).

Replace `src/store/index.ts` with:

<<< @/figures/tutorial/lists-and-the-sidebar/src/store/index.ts [src/store/index.ts]

Subsequent saves include both `tasks` and `lists`. Existing saved tasks remain intact, and `seedLists` supplies lists when loading a file from the previous chapter.

The selected list belongs to navigation state. Keep it out of the store: the route already identifies what the content pane shows. Later chapters put temporary filters in a UI slice and persistent application preferences in GSettings.

## Add the navigator

Install navigation and CSS support from the project directory:

::: code-group

```bash [npm]
npm install @gtkx/navigation@beta @gtkx/css@beta @react-navigation/core@^7
```

```bash [pnpm]
pnpm add @gtkx/navigation@beta @gtkx/css@beta @react-navigation/core@^7
```

:::

Install `@react-navigation/core` directly because [Edit Tasks](/v2/tutorial/the-task-editor) augments its types. GTKX integrates React Navigation with libadwaita. Its split view navigator uses `AdwNavigationSplitView`: the first declared screen is the sidebar, and the remaining screens share a content stack. It supplies each screen's navigation page and header bar.

Create `src/navigation.ts`:

<<< @/figures/tutorial/lists-and-the-sidebar/src/navigation.ts [src/navigation.ts]

`Tasks` carries the selected list in its params. `useSelection` lets the sidebar read that selection and returns `null` when no tasks page is open. The [navigation guide](/v2/guide/navigation) covers GTKX's navigators; React Navigation documents [route typing](https://reactnavigation.org/docs/typescript/).

## Move the window into a component

Create `src/components/window.tsx`:

<<< @/figures/tutorial/lists-and-the-sidebar/src/components/window.tsx [src/components/window.tsx]

`Lists` stays first so it owns the sidebar. `initialRouteName` and `initialParams` open Personal at startup. The tasks page's title follows its route params.

The navigator now owns the toolbar and header. Each screen supplies its content widget. Create `src/components/tasks-screen.tsx`:

<<< @/figures/tutorial/lists-and-the-sidebar/src/components/tasks-screen.tsx [src/components/tasks-screen.tsx]

Replace `src/app.tsx` with:

<<< @/figures/tutorial/lists-and-the-sidebar/src/app.tsx [src/app.tsx]

Keep the existing `src/index.tsx`; it still imports the named `App` export.

## Draw the sidebar

Use a small CSS rule for each list's color. Create `src/styles.ts`:

<<< @/figures/tutorial/lists-and-the-sidebar/src/styles.ts [src/styles.ts]

Adwaita's built-in classes handle the rest of the styling. See [Styling with CSS](/v2/guide/css) for GTKX's CSS integration.

Create `src/components/sidebar.tsx`:

<<< @/figures/tutorial/lists-and-the-sidebar/src/components/sidebar.tsx [src/components/sidebar.tsx]

`useMarkup={false}` keeps list names literal. The colored dot is decorative, so it uses the presentation accessibility role.

## Keep selection in sync {#keeping-gtk4-and-the-route-in-agreement}

`selectedIndex` makes the native selection follow the route; `-1` clears it. `onRowSelected` handles selections made outside GTKX's prop writes. GTKX suppresses the signal caused by its own selection write, avoiding a navigation loop.

For this navigator, `navigate("Tasks", params)` returns to the existing tasks page with new params, removing any pages above it. If that page is absent, it opens it. Selecting a list therefore changes the content pane without accumulating task-list pages.

## Filter the tasks

Replace `src/components/task-list.tsx` with:

<<< @/figures/tutorial/lists-and-the-sidebar/src/components/task-list.tsx [src/components/task-list.tsx]

The screen passes its selection directly to the list. New tasks use that list's ID, while deleted tasks remain hidden.

## Run it

Save the files. Personal is selected in the sidebar, and its tasks appear under a header named Personal.

<figure class="result">
    <img class="result-light" src="/figures/tutorial-lists-and-the-sidebar-light.png" width="542" height="294" loading="lazy" alt="The Tasks window split in two: a sidebar titled Tasks lists Personal, Work, and Shopping, each with a colored dot, and Personal is selected. The content pane, titled Personal, shows the Add a task… entry and the rows Welcome to Tasks and Water the plants." />
    <img class="result-dark" src="/figures/tutorial-lists-and-the-sidebar-dark.png" width="542" height="294" loading="lazy" alt="The Tasks window split in two: a sidebar titled Tasks lists Personal, Work, and Shopping, each with a colored dot, and Personal is selected. The content pane, titled Personal, shows the Add a task… entry and the rows Welcome to Tasks and Water the plants." />
    <figcaption>Captured from <a href="#move-the-window-into-a-component"><code>src/components/window.tsx</code></a> and <a href="#draw-the-sidebar"><code>src/components/sidebar.tsx</code></a> above.</figcaption>
</figure>

Click Work, then Shopping. Add a task in Shopping, switch to Personal, and return: the new task belongs only to Shopping.

Close the window and start `npm run dev` again. Tasks and lists return from disk; navigation starts on Personal again.

## Next

Continue to [Adapt the Layout](/v2/tutorial/an-adaptive-layout).
