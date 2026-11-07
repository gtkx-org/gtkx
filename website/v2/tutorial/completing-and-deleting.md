---
description: "Add row controls for completing, starring, and deleting tasks."
---

# Complete, Star, and Delete Tasks

In [Add Tasks](/v2/tutorial/the-task-store) you moved the task array into a Zustand store. This chapter adds a checkbox, a star, and a delete button to each row.

## More actions on the store

Add store actions for completion, importance, and deletion. They share a helper that updates a task by ID.

In `src/store/index.ts`, add the helper and the actions:

```diff [src/store/index.ts]
@@ -7,0 +8,3 @@
+    setDone: (id: string, done: boolean) => void;
+    setImportant: (id: string, important: boolean) => void;
+    moveToTrash: (id: string) => void;
@@ -8,0 +12,3 @@
+
+const patch = (tasks: Task[], id: string, fields: Partial<Task>): Task[] =>
+    tasks.map((task) => (task.id === id ? { ...task, ...fields } : task));
@@ -35,0 +42,11 @@
+    setDone: (id, done) =>
+        set((state) => ({
+            tasks: patch(state.tasks, id, {
+                done,
+                completedAt: done ? new Date().toISOString() : null,
+            }),
+        })),
+    setImportant: (id, important) =>
+        set((state) => ({ tasks: patch(state.tasks, id, { important }) })),
+    moveToTrash: (id) =>
+        set((state) => ({ tasks: patch(state.tasks, id, { deleted: true }) })),
```

`setDone` records the completion time in `completedAt` and clears it when you uncheck the box.

`moveToTrash` sets a flag instead of removing the task from the array. That keeps the data available for the Trash view in [Filter and Search Tasks](/v2/tutorial/smart-views-and-search) and for undo in [Add Undo and Delete Confirmation](/v2/tutorial/trash-and-toasts). For now, hide deleted tasks from the list.

In `src/components/task-list.tsx`, filter the deleted tasks out before rendering:

```diff [src/components/task-list.tsx]
@@ -31,7 +31,9 @@
-                    {tasks.map((task) => (
-                        <AdwActionRow
-                            key={task.id}
-                            title={task.title}
-                            useMarkup={false}
-                        />
-                    ))}
+                    {tasks
+                        .filter((task) => !task.deleted)
+                        .map((task) => (
+                            <AdwActionRow
+                                key={task.id}
+                                title={task.title}
+                                useMarkup={false}
+                            />
+                        ))}
```

## A component per row

Keep the row's controls together in a `TaskRow` component.

Create `src/components/task-row.tsx`:

<<< @/figures/tutorial/completing-and-deleting/src/components/task-row.tsx [src/components/task-row.tsx]

Then use it from the list. In `src/components/task-list.tsx`:

```diff [src/components/task-list.tsx]
@@ -2 +2 @@
-import { AdwActionRow, AdwClamp, AdwEntryRow } from "@gtkx/jsx/adw";
+import { AdwClamp, AdwEntryRow } from "@gtkx/jsx/adw";
@@ -4,0 +5 @@
+import { TaskRow } from "./task-row.js";
@@ -34,5 +35 @@
-                            <AdwActionRow
-                                key={task.id}
-                                title={task.title}
-                                useMarkup={false}
-                            />
+                            <TaskRow key={task.id} task={task} />
```

`TaskRow` receives the task as a prop and selects the store actions it needs.

## Connecting native controls

`prefix` holds the checkbox, and `suffix` holds the fragment with both trailing buttons. GTKX places those elements in the row's native child slots.

The checkbox and star pair `active` with `onToggled`: the prop follows the task, and the handler receives the emitting widget and saves its new state. The delete button uses `onClicked` to run its action.

With `useMarkup`, the row reads its title as markup. Escape the task title with GLib's [`markupEscapeText`](https://docs.gtk.org/glib/func.markup_escape_text.html) before adding the strikethrough. This keeps titles such as `Buy milk & eggs` literal.

`accessibleLabel` names the icon-only controls for assistive technology and the queries used in [Test the App](/v2/tutorial/testing).

## Run it

Save the files. Each row now has a checkbox, a star, and a trash button. **Water the plants** starts starred because the seed data marks it important.

<figure class="result">
    <img class="result-light" src="/figures/tutorial-completing-and-deleting-light.png" width="360" height="294" loading="lazy" alt="The Tasks window: under the Add a task… entry, three task rows, each with a checkbox before the title and a star and trash button after it. The star on Water the plants is filled." />
    <img class="result-dark" src="/figures/tutorial-completing-and-deleting-dark.png" width="360" height="294" loading="lazy" alt="The Tasks window: under the Add a task… entry, three task rows, each with a checkbox before the title and a star and trash button after it. The star on Water the plants is filled." />
    <figcaption>Captured from <a href="#a-component-per-row"><code>src/components/task-row.tsx</code></a> above.</figcaption>
</figure>

Tick the checkbox on **Welcome to Tasks**. Its title gets a strikethrough, and the box stays ticked.

Click an unfilled star. Its icon fills in. Click it again to clear it.

Click the trash button on a row. The row leaves the list. The task remains in the store with `deleted: true`.

Now quit and start the app again. The seeded tasks return with their original values: this chapter's changes still live only in memory.

## Next

[Save Tasks](/v2/tutorial/saving-to-disk) persists tasks and their changes between launches.
