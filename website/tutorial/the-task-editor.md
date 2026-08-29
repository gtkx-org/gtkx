---
description: "Navigate into a task and edit its title, importance, due date, and notes."
---

# Opening a Task

In [Smart Views, Filters, and Search](/tutorial/smart-views-and-search) you sliced the store by view, filter, and query. A task on screen is still just a title, with no way to see or set `notes`, `due`, `createdAt`, and `completedAt`. This page gives one task a screen of its own and writes every field through a single store action.

## A task is a route

Which task is open is not a field anywhere. It is a page on the content stack, carrying that task's id in its params and sitting above the task list you opened it from. That is the whole of it: pushing the page opens the editor, popping it closes the editor, and the back button, <kbd>Escape</kbd>, <kbd>Alt</kbd>+<kbd>Left</kbd>, and the touchpad back gesture all pop. The code you would otherwise write to close the editor, and the state that code would read, is the navigator's job.

In `src/navigation.ts`, add the route to the param list:

```diff
 export type RootParamList = {
     Lists: undefined;
     Tasks: Selection;
+    Task: { id: string };
 };
```

`Sidebar` and `TasksScreen` are typed with `SplitViewScreenProps`, so each one already has a `navigation` object checked against `RootParamList`. The row that opens a task is not a screen. It sits inside one and reaches navigation with `useNavigation()`, which has no screen props to infer a param list from, so on its own it accepts no route name at all. Declaring the root navigator once settles it for every component in the app.

In `src/navigation.ts`, under `Split`:

```ts
// ...
export const Split = createSplitViewNavigator<RootParamList>();

type RootNavigatorType = typeof Split;

declare module "@react-navigation/core" {
    interface RootNavigator extends RootNavigatorType {}
}
```

The augmentation names `@react-navigation/core` because that is the module declaring the `RootNavigator` interface, and `@gtkx/navigation` re-exports the core API around its own navigators. It is a type declaration and compiles to nothing.

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

Params are values written into navigation state, where they sit until something navigates again, so an id is the right size for them. Looking the task up from that id keeps the editor live: every store write produces a new task object, the screen finds it, and the fields you are about to add redraw without a subscription of their own. Going back needs no teardown either, because the navigator pops the page and unmounts the screen along with it.

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

Adding `setTitle`, `setNotes`, and `setDue` next to `setDone` and `setImportant` means a new action for every control the editor grows. Take a patch instead: an object holding whichever fields changed, merged into the task.

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

`Pick` lists exactly the fields the editor may touch, so a typo like `dueDate` is a type error and a write to `id`, `createdAt`, or `done` will not compile. `Partial` makes each field optional, so a caller sends only what changed. `setDone` and `setImportant` stay, because they are not free-form edits, and `setDone` also stamps `completedAt`.

## The form

`@gtkx/forms` connects Adwaita form rows to React Hook Form: the form owns the values, while the rows still look and behave like native widgets. The scaffolder did not install it. From `tasks/`:

::: code-group

```bash [npm]
npm install @gtkx/forms
```

```bash [pnpm]
pnpm add @gtkx/forms
```

:::

It belongs in `dependencies`, because the form and its state run in the shipped application.

The editor is a scroller wrapping an `AdwClamp`, which caps content width and centers it so the form stays readable in a wide window. `AdwPreferencesGroup` is the container Adwaita uses for a titled block of rows. It draws the boxed-list frame, so rows placed in it get the rounded card, the separators, and the spacing without any styling of your own.

Only the title and importance use the form. `TaskFields` keeps that boundary visible in the type, and `defaultValues` seeds both fields from the task. `FormProvider` makes the form available to every GTKX form row beneath it, so the rows need a `name` but no individually threaded `control` prop.

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

`handleSubmit` reads the form value rather than reaching into the native entry. After the store accepts it, `resetField` makes that submitted title the field's new default and clears its dirty state. The zero-argument wrapper matters because an Adwaita signal passes its widget to the callback, while React Hook Form's returned submit function optionally accepts a web event; this is a native signal, so it calls the submit function with no event.

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

The generic ties `name` to `TaskFields`, so a misspelled field or a field with the wrong value type fails at compile time. `EntryRow` preserves the native Apply and activation callbacks; by the time either fires, the row's text notifications have already updated React Hook Form. That leaves the form in charge of the draft and the store in charge of the committed title.

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

A notify handler receives the new value first, and that value is nullable because the property is read back through the generic GObject machinery, which can return nothing. `?? false` settles it, and every `onNotify*` handler in the app has the same shape. The form row has already received the same change by the time this callback persists it.

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

The date crosses two type systems, so it converts at both ends. The store keeps an ISO string, which survives a round trip through JSON, while `GtkCalendar` wants a `GLib.DateTime`. Build one at the top of the component, where a task with no due date gets none.

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

Pass `?? undefined` rather than the `null`: an `AdwActionRow` given an empty subtitle still reserves the line, and the row grows taller than its neighbors. Given `undefined`, the prop is not set and the row stays single-line.

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

`text` makes the buffer controlled: `onChanged` writes each edit to the store, and the store feeds `text` back. GTKX skips a write when the buffer already holds that value, so a keystroke round-trip leaves the cursor and the undo history alone. `getText` reads the range as a start and end iterator, the trailing `false` leaves out invisible markup, and `enableUndo` gives the notes field its own Ctrl+Z and Ctrl+Shift+Z.

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

The editor holds state outside the task object: React Hook Form's field values, where the cursor sits in the title entry, the buffer's undo stack, and which month the calendar shows. Open one task, go back, open another, and React sees the same `TaskDetail` in the same position and just updates its props. The form and widgets survive, and so does all that state. Activating a row while an editor is already open is the same problem without the trip through the list, since `navigate` swaps the params of the page on the stack rather than pushing a second one.

In `src/components/task-screen.tsx`, give the editor a key:

```diff
-    return task ? <TaskDetail task={task} /> : null;
+    return task ? <TaskDetail key={task.id} task={task} /> : null;
```

A changed key tells React to throw the old tree away and build a new one, so `useForm` reads the new task's defaults and the new task gets fresh widgets: a cursor at the start, an empty undo history, and a calendar opened on its own month. This is the same tool `TasksScreen` uses to reset the list's scroll position when the route's params change.

## The task's header bar

There is no back button to build, and nothing to call when it is pressed. The navigator gives every content page a header bar, and Adwaita draws the back button on any page with a page beneath it. <kbd>Escape</kbd> and <kbd>Alt</kbd>+<kbd>Left</kbd> pop that same page. What the bar still needs is the task's title and the two commands that belong with an open task.

A screen's `options` is a plain object or a plain callback over `{ route, navigation, theme }`. No hooks run in it, and it is `Window` that evaluates it, so this is the case from [Smart Views, Filters, and Search](/tutorial/smart-views-and-search) again: a header widget that shows live state is its own component, subscribing where the widget is. The title tracks the committed `task.title` after Apply or Return, and the star tracks `task.important` as either control flips it. Neither needs to drag the whole window into re-rendering while a title draft changes.

Create `src/components/task-title.tsx`:

```tsx
import { AdwWindowTitle } from "@gtkx/jsx/adw";
import { useStore } from "../store/index.js";

export const TaskTitle = ({ id }: { id: string }) => {
    const title = useStore((state) => state.tasks.find((task) => task.id === id)?.title);

    return <AdwWindowTitle title={title ?? "Task"} />;
};
```

`headerTitle` takes a string or an element. A string is wrapped in an `AdwWindowTitle` for you, and an element is used as the title widget as it stands, which is why this component supplies the `AdwWindowTitle` itself. That is the widget a header bar wants for plain text, and it handles the title typography Adwaita expects.

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

Both take the id and look the task up, the same way the screen does, and both render nothing when the lookup fails. A header widget outlives its task by a moment when that task is deleted, so neither one may assume it is there.

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

`headerEnd` packs widgets at the end of the bar and `headerStart` at the start, after the back button. Nothing goes in `headerStart` here, because getting out of the editor is the one thing you do not have to wire.

Deleting from here leaves the editor open over a task that is now in the trash. Leave that gap for now: [Deleting Without Fear](/tutorial/trash-and-toasts) gives every delete an undo toast and a confirmation, and pops the page along the way.

## Run it

Save the files. The window on your desktop already has the editor in it.

1. Click any task row. The content pane becomes a form with Title, Important, and Due at the top, a Notes box, and a Created timestamp at the bottom. The header bar shows the task's title, with the navigator's back arrow on the left.
2. Start changing the title without applying it, then click the star in the header. The Important switch follows the star and the unfinished title stays in the entry. Press Enter: the header title updates immediately. Click the back arrow and the list is showing again, with the new title on the row. Press <kbd>Escape</kbd> or <kbd>Alt</kbd>+<kbd>Left</kbd> from an open task and it closes the same way, with none of your code involved.
3. Open a task and click Set date. A calendar drops down; pick today. The button reads `Today at 6:00 PM`, a clear button appears beside it, and going back puts the same text under the row's title. Open the task again and click the clear button: the subtitle disappears from the row entirely rather than leaving a blank gap.
4. Type into Notes and press Ctrl+Z: the last thing you typed is undone. Go back, open a different task, and the notes box holds that task's notes with none of the previous undo history. Press Ctrl+Z there and nothing happens.
5. Open a task, then click a different row without going back first. The editor shows the second task, and one press of the back arrow still reaches the list, because the second row swapped the page's params rather than stacking a page on it.

The store still persists on every write, so what the editor sets is on disk before you go anywhere. After setting a due date, read it back:

```bash
jq '.state.tasks[] | select(.due != null) | {title, due}' ~/.local/share/com.gtkx.tutorial/tasks.json
```

The ISO string is the one the calendar produced.

## Checkpoint

This chapter changed:

- `src/navigation.ts`, `src/components/task-row.tsx`, and `src/components/window.tsx` add and open the typed task route.
- `src/store/tasks.ts` adds task updates.
- `src/components/task-detail.tsx`, `src/format.ts`, and `src/styles.ts` build the editable title, importance, due date, notes, and timestamps.
- `src/components/task-screen.tsx`, `src/components/task-title.tsx`, and `src/components/task-buttons.tsx` keep the selected task and its header controls live.

The finished source stays in [`examples/tutorial/src`](https://github.com/gtkx-org/gtkx/tree/main/examples/tutorial/src).

## Next

[Menus, Accelerators, and Shortcuts](/tutorial/actions-menus-shortcuts) turns the commands scattered across these buttons into GActions, puts them in a primary menu, and binds them to keys.
