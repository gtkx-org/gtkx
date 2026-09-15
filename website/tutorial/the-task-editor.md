---
description: "Navigate into a task and edit its title, importance, due date, and notes."
---

# Opening a Task

In [Smart Views, Filters, and Search](/tutorial/smart-views-and-search) you filtered the task list. This chapter adds an editor for a task's title, importance, due date, and notes, along with its creation and completion timestamps.

## A task is a route

The editor is a page on the content stack, with the task's id in its route params. GTKX's navigator provides the Adwaita back button, keyboard shortcuts, and gestures for returning to the list.

In `src/navigation.ts`, add the route to the param list:

```diff
 export type RootParamList = {
     Lists: undefined;
     Tasks: Selection;
+    Task: { id: string };
 };
```

`TaskRow` will use `useNavigation()` to open the editor. Declare the root navigator so the hook uses this app's route types, as the screen props already do.

In `src/navigation.ts`, under `Split`:

```ts
// ...
export const Split = createSplitViewNavigator<RootParamList>();

type RootNavigatorType = typeof Split;

declare module "@react-navigation/core" {
    interface RootNavigator extends RootNavigatorType {}
}
```

The declaration targets `@react-navigation/core`, which owns `RootNavigator`. GTKX re-exports its navigation API and supplies the native navigators; see the [navigation guide](/guide/navigation) for that integration.

An `AdwActionRow` responds to clicks only once you mark it `activatable`, which makes the whole row a target. `onActivated` then fires when the row is clicked or takes Return from the keyboard.

In `src/components/task-row.tsx`, reach navigation and mark the row:

```diff
 import { GtkButton, GtkCheckButton, GtkToggleButton } from "@gtkx/jsx/gtk";
+import { useNavigation } from "@gtkx/navigation";
 import { escapeMarkup } from "../format.js";
```

```diff
 export const TaskRow = ({ task }: { task: Task }) => {
+    const navigation = useNavigation();
     const setDone = useStore((state) => state.setDone);
     const setImportant = useStore((state) => state.setImportant);
     const moveToTrash = useStore((state) => state.moveToTrash);
```

```diff
         <AdwActionRow
             title={title}
             useMarkup
+            activatable
+            onActivated={() => navigation.navigate("Task", { id: task.id })}
             prefix={
```

`navigate` behaves here the way it did for the sidebar in [Lists and a Sidebar](/tutorial/lists-and-the-sidebar). It pushes `Task` when no editor is open, and when one is it returns to the page already on the stack with the new params. Opening one task after another swaps what the single editor page shows instead of piling up editors you then have to back out of one at a time.

## The editor as a screen

The screen receives the id in `route.params` and looks the task up.

Create `src/components/task-screen.tsx`:

```tsx
import type { SplitViewScreenProps } from "@gtkx/navigation";
import type { RootParamList } from "../navigation.js";
import { useStore } from "../store/index.js";
import { TaskDetail } from "./task-detail.js";

export const TaskScreen = ({ route }: SplitViewScreenProps<RootParamList, "Task">) => {
    const task = useStore((state) => state.tasks.find((candidate) => candidate.id === route.params.id));

    return task ? <TaskDetail task={task} /> : null;
};
```

The route carries an id, and the screen subscribes to the matching task so store edits reach the form.

The lookup can miss, which is why the screen renders `null` rather than assuming a task. Deleting a task for good while its page is open is that case, and [Deleting Without Fear](/tutorial/trash-and-toasts) pops the page as part of the delete.

Register it as a third screen. In `src/components/window.tsx`:

```tsx
// ...
import { TaskScreen } from "./task-screen.js";

<Split.Navigator
    // ...
>
    {/* ... */}
    <Split.Screen name="Task" component={TaskScreen} />
</Split.Navigator>
```

With no `options` on it yet, the page takes its header bar title from the route name and gets Adwaita's back button, because there is a page underneath it. The header gains the task's own title and its commands at the end of this page.

## One action, many fields

Add `updateTask` for the fields edited by the form.

In `src/store/tasks.ts`, add `updateTask` to the slice type and to the creator:

```diff
     setImportant: (id: string, important: boolean) => void;
+    updateTask: (id: string, fields: Partial<Pick<Task, "title" | "notes" | "due" | "listId">>) => void;
     moveToTrash: (id: string) => void;
```

```diff
     setImportant: (id, important) => set((state) => ({ tasks: patch(state.tasks, id, { important }) })),
+    updateTask: (id, fields) => set((state) => ({ tasks: patch(state.tasks, id, fields) })),
```

The patch accepts `title`, `notes`, `due`, and `listId`. Keep the existing completion and importance actions; `setDone` also updates `completedAt`. For the type syntax, see TypeScript's [utility types](https://www.typescriptlang.org/docs/handbook/utility-types.html).

## The form

`@gtkx/forms` connects Adwaita form rows to [React Hook Form](https://react-hook-form.com/docs/useform). Install it from `tasks/`:

::: code-group

```bash [npm]
npm install @gtkx/forms
```

```bash [pnpm]
pnpm add @gtkx/forms
```

:::

It belongs in `dependencies`, because the form and its state run in the shipped application.

An `AdwClamp` keeps the form readable in a wide window. Group its native form rows in `AdwPreferencesGroup` for Adwaita's card styling and spacing.

Only title and importance use React Hook Form here. GTKX's form rows select their fields by `name` under `FormProvider`; the [forms guide](/guide/forms) covers their native widget bindings.

Create `src/components/task-detail.tsx`:

```tsx
import { EntryRow, FormProvider, SwitchRow, useForm } from "@gtkx/forms";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwClamp, AdwPreferencesGroup } from "@gtkx/jsx/adw";
import { GtkBox, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { useStore } from "../store/index.js";
import type { Task } from "../types.js";

type TaskFields = Pick<Task, "important" | "title">;

export const TaskDetail = ({ task }: { task: Task }) => {
    const updateTask = useStore((state) => state.updateTask);
    const setImportant = useStore((state) => state.setImportant);
    const form = useForm<TaskFields>({
        defaultValues: { important: task.important, title: task.title },
    });
    const { resetField } = form;

    return (
        <GtkScrolledWindow vexpand>
            <AdwClamp maximumSize={600} marginTop={24} marginBottom={24} marginStart={12} marginEnd={12}>
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={18}>
                    <FormProvider {...form}>
                        <AdwPreferencesGroup />
                    </FormProvider>
                </GtkBox>
            </AdwClamp>
        </GtkScrolledWindow>
    );
};
```

### The title

`EntryRow` renders an `Adw.EntryRow`, but React Hook Form supplies its `text` from the field named by `name` and receives every edit. `showApplyButton` puts a checkmark at the end of the row that lights up once the text differs, and `onApply` fires when it is clicked. `onEntryActivated` fires on Return, so both ways of finishing an edit can submit the form.

Above the return, build that submission:

```tsx
    const saveTitle = form.handleSubmit(({ title }) => {
        updateTask(task.id, { title });
        resetField("title", { defaultValue: title });
    });
    const submitTitle = (): void => {
        void saveTitle();
    };
```

After saving, `resetField` makes the title the new default. Wrap [`handleSubmit`](https://react-hook-form.com/docs/useform/handlesubmit) in a zero-argument callback: the native signal supplies an Adwaita widget, while React Hook Form's submit function expects an optional web event.

In `src/components/task-detail.tsx`, fill the first group:

```tsx
                    <FormProvider {...form}>
                        <AdwPreferencesGroup>
                            <EntryRow<TaskFields>
                                name="title"
                                title="Title"
                                showApplyButton
                                onApply={submitTitle}
                                onEntryActivated={submitTitle}
                            />
                        </AdwPreferencesGroup>
                    </FormProvider>
```

`EntryRow` updates the form before forwarding its native Apply and activation signals. The form holds the title draft until either handler saves it to the store.

### Importance

`SwitchRow` maps its named boolean field to an `Adw.SwitchRow`'s `active` property. It also forwards the native property notification, so the existing store action can keep importance immediate rather than waiting for a form submission.

In `src/components/task-detail.tsx`, add the row under the title:

```tsx
                            <SwitchRow<TaskFields>
                                name="important"
                                title="Important"
                                onNotifyActive={(active) => setImportant(task.id, active ?? false)}
                            />
```

`onNotifyActive` receives the new property value first. The form row has already received the change when this callback saves it to the store.

The switch writes through `setImportant`, the same action the star uses, so flipping it also relights the star in the list. The reverse direction matters too: the header's star can change the store while the form is open. Import `useEffect` from React and reset just the importance field when its stored value changes:

```tsx
import { useEffect } from "react";

// ...

    useEffect(() => {
        resetField("important", { defaultValue: task.important });
    }, [resetField, task.important]);
```

A whole-form reset would also replace a title the user is still editing. This targeted reset updates the switch's current value and default together without touching that draft.

### The due date

`GtkMenuButton` is a button that shows a popover, and its `popover` slot takes that popover as JSX, so the calendar is a child of the popover and the popover belongs to the button. The button's label is the current date, formatted, and a clear button sits beside it only when there is something to clear.

In `src/components/task-detail.tsx`, add the due row to the group:

```tsx
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
```

The store keeps an ISO string, while `GtkCalendar` uses `GLib.DateTime`. Convert the stored date at the top of the component:

In `src/components/task-detail.tsx`:

```tsx
    const setImportant = useStore((state) => state.setImportant);
    const dueDate = task.due ? GLib.DateTime.newFromIso8601(task.due, null) : undefined;
```

Coming back, `self.getDate()` hands you the selected day as a `GLib.DateTime`, and its components go into a JavaScript `Date` set to six in the evening local time, a friendlier default than midnight for a task.

`formatDue` turns the stored string into that label. The row subtitle needs the same function, so it goes in `src/format.ts` beside `isToday` and reuses the `startOfDay` helper already there. `formatDateTime` is the plainer one, for the timestamps at the bottom of the form.

In `src/format.ts`, add both:

```ts
// ...
export const formatDue = (iso: string | null): string | null => {
    if (!iso) return null;
    const due = new Date(iso);
    const days = Math.round((startOfDay(due) - startOfDay(new Date())) / 86_400_000);
    const time = due.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (days === 0) return `Today at ${time}`;
    if (days === 1) return `Tomorrow at ${time}`;
    if (days === -1) return `Yesterday at ${time}`;
    if (days < 0) return `${-days} days ago`;
    if (days < 7) return due.toLocaleDateString([], { weekday: "long" });
    return due.toLocaleDateString([], { month: "short", day: "numeric" });
};

export const formatDateTime = (iso: string | null): string => {
    if (!iso) return "Never";
    return new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
};
```

Returning `null` for a task with no due date lets each caller decide what "no date" looks like. The menu button falls back to `"Set date"`, and the row to no subtitle.

In `src/components/task-row.tsx`, add the subtitle:

```diff
             title={title}
             useMarkup
+            subtitle={formatDue(task.due) ?? undefined}
             activatable
```

Use `undefined` when there is no date to show in the subtitle.

### Notes

Notes are multi-line, so this is a `GtkTextView`. A text view keeps its content in a `GtkTextBuffer`, a separate object (not a widget) that holds the text, the cursor, and the undo history. GTKX exposes it as the `buffer` slot, and the buffer's plain text is the `text` prop.

In `src/components/task-detail.tsx`, add a block after the group:

```tsx
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
```

`onChanged` writes each edit to the store, which feeds `text` back. GTKX skips writes when the buffer already holds that value, preserving the cursor and undo history. `enableUndo` enables native undo; [`getText`](https://docs.gtk.org/gtk4/method.TextBuffer.get_text.html) reads the buffer between its start and end iterators, excluding invisible text when its last argument is `false`.

The `card` style class gives the scroller the framed look Adwaita uses for a content box. You supply the padding yourself.

In `src/styles.ts`, add the class beside `listDot`:

```ts
// ...
export const detailNotes = css`
    padding: 6px;
    min-height: 160px;
`;
```

`css` returns a generated class name, which is why it goes into `cssClasses` as a value rather than a string literal. The [CSS guide](/guide/css) covers the details.

### Timestamps

The last group is read-only: `createdAt` is stamped by `addTask`, `completedAt` by `setDone`. The `property` style class is Adwaita's convention for a row whose subtitle is the value, swapping the emphasis so the value reads larger than the label.

In `src/components/task-detail.tsx`, add the final group:

```tsx
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
```

## Switching tasks cleanly

When navigation changes the id on an existing editor page, reset the form draft and native widget state for the new task. This includes the text buffer's undo history and the calendar's displayed month.

In `src/components/task-screen.tsx`, give the editor a key:

```diff
-    return task ? <TaskDetail task={task} /> : null;
+    return task ? <TaskDetail key={task.id} task={task} /> : null;
```

The task id [resets the editor with a key](https://react.dev/learn/preserving-and-resetting-state#resetting-a-form-with-a-key), giving it fresh form values and widgets. `TasksScreen` uses the same approach for the list's scroll position.

## The task's header bar

Add the task's title and commands to the header bar supplied by the navigator.

As with the filter and search controls, put store subscriptions in header components and pass their elements through the screen's `options`.

Create `src/components/task-title.tsx`:

```tsx
import { AdwWindowTitle } from "@gtkx/jsx/adw";
import { useStore } from "../store/index.js";

export const TaskTitle = ({ id }: { id: string }) => {
    const title = useStore((state) => state.tasks.find((task) => task.id === id)?.title);

    return <AdwWindowTitle title={title ?? "Task"} />;
};
```

`TaskTitle` supplies an `AdwWindowTitle` to the `headerTitle` slot for native header typography.

Create `src/components/task-buttons.tsx`:

```tsx
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

These components also handle a missing task during deletion: the title falls back to "Task" and the buttons disappear.

In `src/components/window.tsx`, give the screen its options:

```diff
+import { TaskButtons } from "./task-buttons.js";
+import { TaskTitle } from "./task-title.js";
```

```diff
-<Split.Screen name="Task" component={TaskScreen} />
+<Split.Screen
+    name="Task"
+    component={TaskScreen}
+    options={({ route }) => ({
+        headerTitle: <TaskTitle id={route.params.id} />,
+        headerEnd: <TaskButtons id={route.params.id} />,
+    })}
+/>
```

`headerEnd` puts the task buttons at the trailing end of the bar.

Deleting from here leaves the editor open over a task that is now in the trash. Leave that gap for now: [Deleting Without Fear](/tutorial/trash-and-toasts) gives every delete an undo toast and a confirmation, and pops the page along the way.

## Run it

Save the files. The window on your desktop already has the editor in it.

1. Click any task row. The content pane becomes a form with Title, Important, and Due at the top, a Notes box, and a Created timestamp at the bottom. The header bar shows the task's title, with the navigator's back arrow on the left.
2. Start changing the title without applying it, then click the star in the header. The Important switch follows the star and the unfinished title stays in the entry. Return to the title and press Enter: the header title updates. Use the back arrow, <kbd>Escape</kbd>, or <kbd>Alt</kbd>+<kbd>Left</kbd> to return to the list.
3. Open a task and click Set date. Pick today: the button shows today's date at 18:00 in your locale's time format, and a clear button appears beside it. The task row shows the same due date. Clear the date and the subtitle disappears.
4. Type into Notes and press Ctrl+Z: the last thing you typed is undone. Go back, open a different task, and the notes box holds that task's notes with none of the previous undo history. Press Ctrl+Z there and nothing happens.

The store still persists on every write, so what the editor sets is on disk before you go anywhere. After setting a due date, read it back:

```bash
jq '.state.tasks[] | select(.due != null) | {title, due}' ~/.local/share/com.gtkx.tutorial/tasks.json
```

The ISO string is the one the calendar produced.

## Checkpoint

The finished editor. `src/components/task-detail.tsx`:

```tsx
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
        updateTask(task.id, { title });
        resetField("title", { defaultValue: title });
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

## Next

[Menus, Accelerators, and Shortcuts](/tutorial/actions-menus-shortcuts) turns the commands scattered across these buttons into GActions, puts them in a primary menu, and binds them to keys.
