---
description: "Open a task on the content stack and edit it with native form rows, a calendar, and a text buffer."
---

# Edit Tasks

Give each task an editor with a title, importance switch, due date, and notes. It opens above the task list on the content stack; the navigator supplies its header and back navigation.

## Add the route

In `src/navigation.ts`, extend `RootParamList`:

```diff [src/navigation.ts]
@@ -6,0 +7 @@
+    Task: { id: string };
```

Below `Split`, declare the root navigator type so components can use `useNavigation` without passing navigation through their props:

```diff [src/navigation.ts]
@@ -21,0 +22,6 @@
+
+type RootNavigatorType = typeof Split;
+
+declare module "@react-navigation/core" {
+    interface RootNavigator extends RootNavigatorType { }
+}
```

GTKX re-exports the React Navigation core API, so this augmentation targets `@react-navigation/core`. See React Navigation's [TypeScript guide](https://reactnavigation.org/docs/typescript/) for the underlying pattern.

In `src/components/task-row.tsx`, import `useNavigation` and read it inside `TaskRow`:

```diff [src/components/task-row.tsx]
@@ -4,0 +5 @@
+import { useNavigation } from "@gtkx/navigation";
```


```diff [src/components/task-row.tsx]
@@ -9,0 +10 @@
+    const navigation = useNavigation();
```

Make the action row activatable and open the editor from its signal:

```diff [src/components/task-row.tsx]
@@ -20,0 +21,2 @@
+            activatable
+            onActivated={() => navigation.navigate("Task", { id: task.id })}
```

An activatable row responds to a click or keyboard activation. `navigate("Task", { id })` opens the editor, or changes the params of its existing page.

Create `src/components/task-screen.tsx`:

```tsx [src/components/task-screen.tsx]
import type { SplitViewScreenProps } from "@gtkx/navigation";
import type { RootParamList } from "../navigation.js";
import { useStore } from "../store/index.js";
import { TaskDetail } from "./task-detail.js";

export const TaskScreen = ({ route }: SplitViewScreenProps<RootParamList, "Task">) => {
    const task = useStore((state) => state.tasks.find((candidate) => candidate.id === route.params.id));

    return task ? <TaskDetail key={task.id} task={task} /> : null;
};
```

The route stores an ID; the screen reads the current task from the store. The key gives a different task fresh native widgets and form defaults when the existing route changes IDs. Back removes the editor page; opening it again creates a new page.

## Add the editing action

In `src/store/tasks.ts`, add `updateTask` to the slice type and implementation:

```diff [src/store/tasks.ts]
@@ -10,0 +11 @@
+    updateTask: (id: string, fields: Partial<Pick<Task, "title" | "notes" | "due" | "listId">>) => void;
```


```diff [src/store/tasks.ts]
@@ -48,0 +49 @@
+    updateTask: (id, fields) => set((state) => ({ tasks: patch(state.tasks, id, fields) })),
```

Keep `setDone` for completion timestamps and `setImportant` for the shared star/switch behavior.

## Add date formatting and notes styling

Append these functions to `src/format.ts`, after the existing `startOfDay` and `isToday` helpers:

```diff [src/format.ts]
@@ -6,0 +7,18 @@
+
+export const formatDue = (iso: string | null): string | null => {
+    if (!iso) return null;
+    const due = new Date(iso);
+    const days = Math.round((startOfDay(due) - startOfDay(new Date())) / 86_400_000);
+    const time = due.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
+    if (days === 0) return `Today at ${time}`;
+    if (days === 1) return `Tomorrow at ${time}`;
+    if (days === -1) return `Yesterday at ${time}`;
+    if (days < 0) return `${-days} days ago`;
+    if (days < 7) return due.toLocaleDateString([], { weekday: "long" });
+    return due.toLocaleDateString([], { month: "short", day: "numeric" });
+};
+
+export const formatDateTime = (iso: string | null): string => {
+    if (!iso) return "Never";
+    return new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
+};
```

In `src/components/task-row.tsx`, import the formatter and add the subtitle:

```diff [src/components/task-row.tsx]
@@ -0,0 +1 @@
+import { formatDue } from "../format.js";
```


```diff [src/components/task-row.tsx]
@@ -21,0 +22 @@
+            subtitle={formatDue(task.due) ?? undefined}
```

When no due date remains, `undefined` resets the subtitle to its native default. The row then has no subtitle text.

Append the notes style to `src/styles.ts`:

```diff [src/styles.ts]
@@ -8,0 +9,5 @@
+
+export const detailNotes = css`
+    padding: 6px;
+    min-height: 160px;
+`;
```

## Build the editor

Install `@gtkx/forms` from the project directory:

::: code-group

```bash [npm]
npm install @gtkx/forms@beta
```

```bash [pnpm]
pnpm add @gtkx/forms@beta
```

:::

GTKX form rows connect native Adwaita controls to React Hook Form. This form keeps a title draft until Apply or Enter; importance and the other fields save immediately. For the form API itself, use the [React Hook Form documentation](https://react-hook-form.com/docs/useform).

Create `src/components/task-detail.tsx`:

```tsx [src/components/task-detail.tsx]
import { EntryRow, FormProvider, SwitchRow, useForm } from "@gtkx/forms";
import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwActionRow, AdwClamp, AdwPreferencesGroup } from "@gtkx/jsx/adw";
import {
    GtkBox,
    GtkButton,
    GtkCalendar,
    GtkLabel,
    GtkMenuButton,
    GtkPopover,
    GtkScrolledWindow,
    GtkTextBuffer,
    GtkTextView,
} from "@gtkx/jsx/gtk";
import { useEffect } from "react";
import { formatDateTime, formatDue } from "../format.js";
import { useStore } from "../store/index.js";
import { detailNotes } from "../styles.js";
import type { Task } from "../types.js";

type TaskFields = Pick<Task, "important" | "title">;

export const TaskDetail = ({ task }: { task: Task }) => {
    const updateTask = useStore((state) => state.updateTask);
    const setImportant = useStore((state) => state.setImportant);
    const dueDate = task.due ? GLib.DateTime.newFromIso8601(task.due, null) : undefined;
    const form = useForm<TaskFields>({
        defaultValues: { important: task.important, title: task.title },
    });
    const { resetField } = form;

    useEffect(() => {
        resetField("important", { defaultValue: task.important });
    }, [resetField, task.important]);

    const saveTitle = form.handleSubmit(({ title }) => {
        const normalized = title.trim();
        updateTask(task.id, { title: normalized });
        resetField("title", { defaultValue: normalized });
    });
    const submitTitle = (): void => {
        void saveTitle();
    };

    return (
        <GtkScrolledWindow vexpand>
            <AdwClamp maximumSize={600} marginTop={24} marginBottom={24} marginStart={12} marginEnd={12}>
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={18}>
                    <FormProvider {...form}>
                        <AdwPreferencesGroup>
                            <EntryRow<TaskFields>
                                name="title"
                                title="Title"
                                showApplyButton
                                rules={{ validate: (title) => title.trim().length > 0 }}
                                onApply={submitTitle}
                                onEntryActivated={submitTitle}
                            />
                            <SwitchRow<TaskFields>
                                name="important"
                                title="Important"
                                onNotifyActive={(active) => setImportant(task.id, active ?? false)}
                            />
                            <AdwActionRow
                                title="Due"
                                suffix={
                                    <GtkBox spacing={6} valign={Gtk.Align.CENTER}>
                                        {task.due ? (
                                            <GtkButton
                                                iconName="edit-clear-symbolic"
                                                cssClasses={["flat", "circular"]}
                                                accessibleLabel="Clear due date"
                                                onClicked={() => updateTask(task.id, { due: null })}
                                            />
                                        ) : null}
                                        <GtkMenuButton
                                            label={formatDue(task.due) ?? "Set date"}
                                            popover={
                                                <GtkPopover>
                                                    <GtkCalendar
                                                        date={dueDate}
                                                        onDaySelected={(self) => {
                                                            const date = self.getDate();
                                                            const picked = new Date(
                                                                date.getYear(),
                                                                date.getMonth() - 1,
                                                                date.getDayOfMonth(),
                                                                18,
                                                                0,
                                                                0,
                                                            );
                                                            updateTask(task.id, { due: picked.toISOString() });
                                                        }}
                                                    />
                                                </GtkPopover>
                                            }
                                        />
                                    </GtkBox>
                                }
                            />
                        </AdwPreferencesGroup>
                    </FormProvider>

                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6}>
                        <GtkLabel halign={Gtk.Align.START} cssClasses={["heading"]}>
                            Notes
                        </GtkLabel>
                        <GtkScrolledWindow cssClasses={["card"]} heightRequest={160}>
                            <GtkTextView
                                wrapMode={Gtk.WrapMode.WORD_CHAR}
                                cssClasses={[detailNotes]}
                                buffer={
                                    <GtkTextBuffer
                                        enableUndo
                                        text={task.notes}
                                        onChanged={(buffer) =>
                                            updateTask(task.id, {
                                                notes: buffer.getText(
                                                    buffer.getStartIter(),
                                                    buffer.getEndIter(),
                                                    false,
                                                ),
                                            })
                                        }
                                    />
                                }
                            />
                        </GtkScrolledWindow>
                    </GtkBox>

                    <AdwPreferencesGroup>
                        <AdwActionRow
                            cssClasses={["property"]}
                            title="Created"
                            subtitle={formatDateTime(task.createdAt)}
                        />
                        {task.completedAt ? (
                            <AdwActionRow
                                cssClasses={["property"]}
                                title="Completed"
                                subtitle={formatDateTime(task.completedAt)}
                            />
                        ) : null}
                    </AdwPreferencesGroup>
                </GtkBox>
            </AdwClamp>
        </GtkScrolledWindow>
    );
};
```

`submitTitle` invokes the form's submit handler without passing the native signal's widget as a web event. Blank titles stay invalid and unsaved; accepted titles are trimmed. Resetting only the importance field lets the header star update the switch without replacing an unfinished title.

The calendar is JSX in the menu button's `popover` slot. Its native date is a `GLib.DateTime`; the selected day becomes an ISO string at 6 PM local time. `GLib.DateTime` is a boxed value, so creating it for a property does not create a GObject outside JSX.

The notes editor uses a `GtkTextBuffer` in the text view's `buffer` slot. `onChanged` writes the current text to the store. GTKX avoids rewriting identical buffer text, preserving the native cursor and undo history while that edit returns through the `text` prop.

## Add the header widgets

Create `src/components/task-title.tsx`:

```tsx [src/components/task-title.tsx]
import { AdwWindowTitle } from "@gtkx/jsx/adw";
import { useStore } from "../store/index.js";

export const TaskTitle = ({ id }: { id: string }) => {
    const title = useStore((state) => state.tasks.find((task) => task.id === id)?.title);

    return <AdwWindowTitle title={title ?? "Task"} />;
};
```

The title reads the committed task value and falls back to “Task” if the task has gone away.

Create `src/components/task-buttons.tsx`:

```tsx [src/components/task-buttons.tsx]
import { GtkButton, GtkToggleButton } from "@gtkx/jsx/gtk";
import { useStore } from "../store/index.js";

export const TaskButtons = ({ id }: { id: string }) => {
    const setImportant = useStore((state) => state.setImportant);
    const moveToTrash = useStore((state) => state.moveToTrash);
    const task = useStore((state) => state.tasks.find((candidate) => candidate.id === id));

    if (!task) return null;

    return (
        <>
            <GtkToggleButton
                iconName={task.important ? "starred-symbolic" : "non-starred-symbolic"}
                active={task.important}
                tooltipText="Important"
                onToggled={(self) => setImportant(task.id, self.active)}
            />
            <GtkButton iconName="user-trash-symbolic" tooltipText="Delete" onClicked={() => moveToTrash(task.id)} />
        </>
    );
};
```

Both controls use the same store actions as the task row. The buttons disappear if their task is removed.

In `src/components/window.tsx`, add these imports:

```diff [src/components/window.tsx]
@@ -0,0 +1,3 @@
+import { TaskButtons } from "./task-buttons.js";
+import { TaskScreen } from "./task-screen.js";
+import { TaskTitle } from "./task-title.js";
```

Add the editor after the `Tasks` screen in `Split.Navigator`:

```diff [src/components/window.tsx]
@@ -62,0 +63,8 @@
+                    <Split.Screen
+                        name="Task"
+                        component={TaskScreen}
+                        options={({ route }) => ({
+                            headerTitle: <TaskTitle id={route.params.id} />,
+                            headerEnd: <TaskButtons id={route.params.id} />,
+                        })}
+                    />
```

`headerTitle` replaces the title widget; `headerEnd` holds the task commands. The navigator handles the back button, Escape, and Alt+Left.

Deleting here currently moves the task to Trash while leaving its editor open. [Add Undo and Delete Confirmation](/v2/tutorial/trash-and-toasts) will add undo and confirmation behavior and close that page.

## Run it

1. Open a task. Its editor should show Title, Important, Due, Notes, and Created.
2. Enter a blank title and confirm it remains unsaved. Then enter a padded title, toggle the header star, and press Enter. The switch should follow without replacing the draft, and the saved title should be trimmed.
3. Pick a due date, return to the list, and check its subtitle. Reopen the task and clear the date; the subtitle should disappear.
4. Type notes and use Ctrl+Z. Go back and open another task; its notes and undo history should be independent.
5. Close an editor with the back button, Escape, and Alt+Left on separate visits.

Restart the app and reopen the task to confirm the committed fields were saved.

## Next

Continue to [Add Menus and Shortcuts](/v2/tutorial/actions-menus-shortcuts).
