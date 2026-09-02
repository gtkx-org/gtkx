---
description: "Make deletion recoverable with an Undo toast, a confirmation dialog, and a Trash you can empty."
---

# Deleting Without Fear

Delete is one of the commands you wired up in [Menus, Accelerators, and Shortcuts](/v2/tutorial/actions-menus-shortcuts). Right now the trash button on a row, the one in the open task's header, and the Delete key all move a task out of sight with no warning and no way back, and the editor stays open over a task that is no longer in any list.

Here you make deletion recoverable. A task moves to Trash with a toast offering Undo, deleting it again asks first, and either one closes the editor that was showing it. Along the way you build the dialog for creating a list.

## Toasts and dialogs

A toast is an event: it reports something that already happened, then slides away on its own. You push one imperatively, by calling a function.

A dialog is a state. The app waits until you answer, so it is declarative: a field in your store says a dialog is showing, and mounting the component presents it, as [Menus, Accelerators, and Shortcuts](/v2/tutorial/actions-menus-shortcuts) set up for the About and Shortcuts dialogs.

Soft-deleting is a toast. Permanent deletion is a dialog.

## The undo toast

Adwaita shows toasts through an `AdwToastOverlay`, which wraps the widgets they appear over: in your window, everything the navigator draws.

A task is deleted from a row, from the open task's header, and from the Delete key, all far from the overlay. Threading a callback down through the sidebar, the screens, and every row is the prop-drilling the store exists to avoid. Reach the overlay through React context instead: `useToast` returns a controller that shows one.

The overlay is a widget, so it can only wrap what is on screen. The Delete shortcut is not on screen: it sits in the window's `controllers` slot, outside the navigator and outside the overlay, and it deletes tasks too. So the context that carries the overlay has to sit higher than the overlay widget does. `@gtkx/components` ships that split as `ToastProvider` and `useToast`: you hand the provider a ref, give the same ref to an `AdwToastOverlay` mounted wherever the toasts should appear, and every `useToast` below the provider shows toasts on that overlay.

The scaffolder did not install that package. From `tasks/`:

::: code-group

```bash [npm]
npm install @gtkx/components@beta
```

```bash [pnpm]
pnpm add @gtkx/components@beta
```

:::

Like zustand, it belongs in `dependencies`: the toast helpers it supplies run in the shipped application.

Wire both in `src/components/window.tsx`. Hold the overlay in a ref, wrap the window in `ToastProvider`, and mount the overlay around the navigator:

```tsx
import { ToastProvider } from "@gtkx/components";
import { AdwApplicationWindow, AdwBreakpoint, AdwStatusPage, AdwToastOverlay } from "@gtkx/jsx/adw";
import { useRef } from "react";

// ...

const toastOverlayRef = useRef<Adw.ToastOverlay | null>(null);

// ...

<ToastProvider overlayRef={toastOverlayRef}>
    <AdwApplicationWindow
        title="Tasks"
        // ...
    >
        <AdwToastOverlay ref={toastOverlayRef}>
            <NavigationContainer ref={navigationRef}>
                {/* ... */}
            </NavigationContainer>
        </AdwToastOverlay>
        <Dialogs />
    </AdwApplicationWindow>
</ToastProvider>
```

`ToastProvider` shares the ref through context, and the `AdwToastOverlay` fills it: every GTKX element accepts a `ref`, and the value you get is the widget itself, an `Adw.ToastOverlay` with every method the Adwaita documentation lists. The provider wraps the window while the overlay wraps only what the navigator draws, so the Delete shortcut and the dialogs sit inside the provider even though toasts appear over the content alone.

Putting the overlay outside `NavigationContainer` costs nothing, because the container is providers and no widgets. The first widget under the overlay is the split view the navigator builds, which is what you want the toasts to float over.

`useToast` returns `show`, which builds a toast and hands it to the overlay, and `dismiss`, which removes a single one; its companion `useToastOverlay` returns `dismissAll`. Calling any of them outside a `ToastProvider` throws, so a missing provider is a loud error rather than a silent no-op.

## Restoring

`moveToTrash` from [Completing, Starring, and Deleting](/v2/tutorial/completing-and-deleting) only flips the `deleted` flag, so the task is still in the array, still in the file on disk, and already showing in the Trash view you added in [Smart Views, Filters, and Search](/v2/tutorial/smart-views-and-search). Add the moves that flag implies: put the task back, or remove it for good.

In `src/store/tasks.ts`, add to the slice type and to the creator:

```diff
     moveToTrash: (id: string) => void;
+    restore: (id: string) => void;
+    deleteForever: (id: string) => void;
```

```diff
     moveToTrash: (id) => set((state) => ({ tasks: patch(state.tasks, id, { deleted: true }) })),
+    restore: (id) => set((state) => ({ tasks: patch(state.tasks, id, { deleted: false }) })),
+    deleteForever: (id) => set((state) => ({ tasks: state.tasks.filter((task) => task.id !== id) })),
```

`restore` is all the Undo button calls. `deleteForever` is the only place in the app that removes a task from the array, which is why it is worth a confirmation.

The Undo callback is not inside a component, so it has no hooks and never re-renders. It does not need them: your store is a plain object with a `getState` method, and any module can read it or call an action on it. [Reminders That Reach the Desktop](/v2/tutorial/reminders) uses that again from a background sweep.

## Confirming a permanent delete

A task already in Trash has nothing left to soft-delete. Pressing its trash button means permanent deletion, so this case gets a dialog.

The store needs to know which task the dialog is asking about. In `src/store/ui.ts`, add the field and its action:

```diff
     dialog: DialogKind;
+    taskToDelete: string | null;
```

```diff
     showDialog: (dialog: DialogKind) => void;
+    askDeleteTask: (taskToDelete: string | null) => void;
```

```diff
     dialog: "none",
+    taskToDelete: null,
```

```diff
     showDialog: (dialog) => set({ dialog }),
+    askDeleteTask: (taskToDelete) => set({ taskToDelete, dialog: taskToDelete === null ? "none" : "delete-task" }),
```

`askDeleteTask` sets both fields at once, so a delete dialog is never showing without a task behind it. Passing `null` dismisses it.

Add the new kinds to `src/types.ts`. `delete-task` is the confirmation you build next, and `new-list` is the form dialog later on this page:

```diff
-export type DialogKind = "none" | "about" | "shortcuts";
+export type DialogKind = "none" | "about" | "shortcuts" | "new-list" | "delete-task";
```

Removing a task from the array has a consequence flipping a flag does not. `TaskScreen` looks its task up by id and renders nothing when the lookup misses, which is the gap [Opening a Task](/v2/tutorial/the-task-editor) left open: the page stays on the stack, empty, with the back button as the only way off it. A page is not data, so deleting the task does not take it away. Something has to pop it.

Add the last helper to `src/navigation.ts`:

```ts
// ...

export const closeTaskIfOpen = (id: string): void => {
    if (openTaskId() === id) navigationRef.goBack();
};
```

It asks the question `openTaskId` already answers and pops only when the answer names the task on its way out, so deleting a task you are not looking at leaves the navigation state alone. `goBack` here is the same pop the back button performs, dispatched through the ref instead of pressed.

Now the dialog. Create `src/components/delete-confirmation.tsx`:

```tsx
import * as Adw from "@gtkx/gi/adw";
import { AdwAlertDialog } from "@gtkx/jsx/adw";
import { closeTaskIfOpen } from "../navigation.js";
import { useStore } from "../store/index.js";

export const DeleteConfirmation = () => {
    const taskToDelete = useStore((state) => state.taskToDelete);
    const tasks = useStore((state) => state.tasks);
    const deleteForever = useStore((state) => state.deleteForever);
    const askDeleteTask = useStore((state) => state.askDeleteTask);
    const title = tasks.find((task) => task.id === taskToDelete)?.title ?? "";

    return (
        <AdwAlertDialog
            heading="Delete Task?"
            body={`“${title}” will be permanently deleted. This cannot be undone.`}
            defaultResponse="cancel"
            closeResponse="cancel"
            responses={[
                { id: "cancel", label: "Cancel" },
                { id: "delete", label: "Delete", appearance: Adw.ResponseAppearance.DESTRUCTIVE },
            ]}
            onResponse={(id) => {
                if (id === "delete" && taskToDelete !== null) {
                    closeTaskIfOpen(taskToDelete);
                    deleteForever(taskToDelete);
                }
                askDeleteTask(null);
            }}
        />
    );
};
```

`AdwAlertDialog` declares its buttons as data. The `id` of each entry in `responses` comes back to `onResponse`, so the handler is one branch on a string rather than a callback per button. `Adw.ResponseAppearance.DESTRUCTIVE` paints Delete red, the standard GNOME signal for an action you cannot take back.

`defaultResponse` and `closeResponse` are the keyboard's answers: Return picks the default, while Escape and the window manager's close button pick the close response. On a destructive dialog both should point at the safe response, and both point at `cancel` here, so neither key deletes the task.

Both calls in the delete branch sit behind the same `taskToDelete !== null` check, so a dialog with no task behind it can neither pop a page nor remove one. `onResponse` fires for every answer, including the close response, so clearing `taskToDelete` at the end covers cancel, Escape, and delete alike.

Mount it from `src/components/dialogs.tsx`:

```diff
+import { DeleteConfirmation } from "./delete-confirmation.js";
+
         case "shortcuts":
             return <Shortcuts onClose={close} />;
+        case "delete-task":
+            return <DeleteConfirmation />;
         case "none":
             return null;
```

## One place that decides

The trash button on a row, the trash button in the open task's header, and the Delete key all need the same branch, and none of them should carry it. `dialogs.tsx` already owns which dialog is showing, so give it this decision too.

Because that branch raises a toast, it reads the overlay from context, which makes it a hook. Add to `src/components/dialogs.tsx`:

```tsx
import { useToast } from "@gtkx/components";
import { closeTaskIfOpen } from "../navigation.js";
import type { Task } from "../types.js";

// ...

export const useRequestDeleteTask = (): ((task: Task) => void) => {
    const { show } = useToast();

    return (task) => {
        const { moveToTrash, restore, askDeleteTask } = useStore.getState();
        if (task.deleted) {
            askDeleteTask(task.id);
            return;
        }
        closeTaskIfOpen(task.id);
        moveToTrash(task.id);
        show({
            title: `“${task.title}” moved to Trash`,
            buttonLabel: "Undo",
            onButtonClicked: () => restore(task.id),
        });
    };
};
```

`useRequestDeleteTask` runs `useToast` once and returns the handler the buttons call. The handler reads the store with `useStore.getState()` at the moment it runs, so its values are always current, while the toast overlay comes from the context above it.

Closing the editor goes through the module helper for the same reason the store does. This one handler is called from a row inside a screen, from a button in a screen's header options, and from the Delete shortcut mounted on the window, outside the navigation container altogether. There is no single `useNavigation` that answers in all three places. The ref answers everywhere, so `closeTaskIfOpen` works wherever the handler ends up.

A task already in Trash raises the dialog. Anything else pops the editor when that task is the one on it, moves the task to Trash, and shows a toast whose Undo calls `restore`. Undo puts the flag back and nothing else: a task returning to its list should not pull you into an editor you had already left.

Point the call sites at it. Each calls `useRequestDeleteTask` at the top of the component and hands the result to its button. In `src/components/task-row.tsx`:

```diff
+import { useRequestDeleteTask } from "./dialogs.js";
+
 export const TaskRow = ({ task }: { task: Task }) => {
+    const requestDeleteTask = useRequestDeleteTask();
     const navigation = useNavigation();
     const setDone = useStore((state) => state.setDone);
```

```diff
-                        onClicked={() => moveToTrash(task.id)}
+                        onClicked={() => requestDeleteTask(task)}
```

The open task's header does the same in `src/components/task-buttons.tsx`:

```diff
+import { useRequestDeleteTask } from "./dialogs.js";
+
 export const TaskButtons = ({ id }: { id: string }) => {
+    const requestDeleteTask = useRequestDeleteTask();
     const setImportant = useStore((state) => state.setImportant);
-    const moveToTrash = useStore((state) => state.moveToTrash);
```

```diff
-                onClicked={() => moveToTrash(task.id)}
+                onClicked={() => requestDeleteTask(task)}
```

And in `src/components/app-shortcuts.tsx`, where the Delete key lands, take the handler from the hook:

```diff
+import { useRequestDeleteTask } from "./dialogs.js";
+
 export const AppShortcuts = () => {
+    const requestDeleteTask = useRequestDeleteTask();
+
     const toggleSearch = (): boolean => {
```

```diff
     const deleteOpenTask = (): boolean => {
-        const id = openTaskId();
-        if (id === null) return false;
-        useStore.getState().moveToTrash(id);
+        const task = useStore.getState().tasks.find((candidate) => candidate.id === openTaskId());
+        if (!task) return false;
+        requestDeleteTask(task);
         return true;
     };
```

Each site calls `useRequestDeleteTask` and drops its own `moveToTrash` selection, so each button just reports what the user asked for and leaves the decision to the hook. The shortcut still returns `false` when it finds nothing, so Delete keeps travelling on every route but `Task`, and it now looks the task up rather than only its id, because the hook decides from the task's own `deleted` flag which of the two deletions this is.

## A dialog that is a form

Lists have been in the sidebar since [Lists and a Sidebar](/v2/tutorial/lists-and-the-sidebar), seeded and fixed. Creating one needs a name and a color, and an alert dialog can carry that form: its children become the dialog's extra child, laid out below the heading and body text and above the response buttons, so the heading and the buttons stay exactly where they are.

Create `src/components/new-list-dialog.tsx`:

```tsx
import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwAlertDialog } from "@gtkx/jsx/adw";
import { GtkBox, GtkEntry, GtkToggleButton } from "@gtkx/jsx/gtk";
import { useState } from "react";
import { useStore } from "../store/index.js";
import { listDot } from "../styles.js";

const PALETTE = ["#3584e4", "#2ec27e", "#e66100", "#9141ac", "#e01b24", "#f5c211"];

export const NewListDialog = () => {
    const addList = useStore((state) => state.addList);
    const showDialog = useStore((state) => state.showDialog);
    const [name, setName] = useState("");
    const [color, setColor] = useState("#3584e4");
    const [firstSwatch, setFirstSwatch] = useState<Gtk.ToggleButton | null>(null);

    return (
        <AdwAlertDialog
            heading="New List"
            defaultResponse="add"
            closeResponse="cancel"
            responses={[
                { id: "cancel", label: "Cancel" },
                { id: "add", label: "Add", appearance: Adw.ResponseAppearance.SUGGESTED },
            ]}
            onResponse={(id) => {
                if (id === "add") addList(name, color);
                showDialog("none");
            }}
        >
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={16} marginTop={8}>
                <GtkEntry placeholderText="List name" activatesDefault onChanged={(self) => setName(self.text)} />
                <GtkBox spacing={6} halign={Gtk.Align.CENTER}>
                    {PALETTE.map((swatch, index) => (
                        <GtkToggleButton
                            key={swatch}
                            ref={index === 0 ? setFirstSwatch : undefined}
                            group={index === 0 ? undefined : firstSwatch}
                            active={color === swatch}
                            cssClasses={["flat"]}
                            accessibleLabel={`Color ${swatch}`}
                            onClicked={() => setColor(swatch)}
                        >
                            <GtkBox
                                widthRequest={22}
                                heightRequest={22}
                                cssClasses={[listDot(swatch)]}
                                accessibleRole={Gtk.AccessibleRole.PRESENTATION}
                            />
                        </GtkToggleButton>
                    ))}
                </GtkBox>
            </GtkBox>
        </AdwAlertDialog>
    );
};
```

Here `defaultResponse` is `add`: nothing is destroyed, so the safe answer and the expected answer are the same. `SUGGESTED` is the counterpart to `DESTRUCTIVE`, painting Add as the accent-colored button the dialog steers you toward.

`activatesDefault` on the entry makes Return in the text field trigger the default response, so you can type a name and press Return without reaching for the mouse.

The name and chosen color are transient form state that disappears when the dialog closes, so they live in `useState` rather than the store. Only the finished list, handed to `addList`, needs to persist.

The swatches are one radio group: each `GtkToggleButton` past the first joins the first through the `group` prop, so GTK keeps exactly one active and never lets a click clear the selection. `active={color === swatch}` seeds that from the current color, and the `ref` on the first button captures it so the others can group onto it. The dot inside uses `listDot` from `src/styles.ts`, the same helper the sidebar uses, so a color reads identically in the picker and in the list it names. A dot carries no text, so the button gets an `accessibleLabel` and the dot is marked `PRESENTATION` to keep it out of the accessibility tree.

Mount it alongside the other dialogs in `src/components/dialogs.tsx`:

```diff
+import { NewListDialog } from "./new-list-dialog.js";
+
+        case "new-list":
+            return <NewListDialog />;
         case "delete-task":
             return <DeleteConfirmation />;
```

Give the sidebar's header bar a button to raise it. The sidebar is a screen, so its header bar is described by its `options`, and `headerStart` is where a button goes. In `src/components/window.tsx`:

```diff
 const collapsed = useStore((state) => state.collapsed);
 const setCollapsed = useStore((state) => state.setCollapsed);
+const showDialog = useStore((state) => state.showDialog);
```

```diff
 <Split.Screen
     name="Lists"
     component={Sidebar}
-    options={{ title: "Tasks" }}
+    options={{
+        title: "Tasks",
+        headerStart: (
+            <GtkButton
+                iconName="list-add-symbolic"
+                tooltipText="New List"
+                onClicked={() => showDialog("new-list")}
+            />
+        ),
+    }}
 />
```

Reading the store from inside a screen's options is what [Smart Views, Filters, and Search](/v2/tutorial/smart-views-and-search) sent the filter and the search button out of the options to avoid. This one is safe: `showDialog` is an action, and an action's identity is fixed for the life of the store, so `Window` has subscribed to something that never changes and never re-renders for it.

## Run it

Save your files and go back to the window.

Delete a task from any list: the row leaves immediately and a toast slides up saying it moved to Trash. Click **Undo** and the task returns to its list with its notes, star, and due date intact. Let a second toast expire on its own and the task stays in Trash, and the sidebar's Trash count goes up.

Open a task and delete it from its own header, or with the `Delete` key. The editor closes on the way out and the toast appears over the list you land back on. Click **Undo**: the task returns to the list, and the editor stays closed.

Select **Trash** in the sidebar and press the trash button on a row there. A dialog appears naming the task and offering Cancel and a red Delete. Press **Escape** and the dialog closes with the task still in Trash. Press Delete instead and it is gone from the list, from Trash, and from `tasks.json` after the next write. Do the same with that task's editor open, and the editor goes with it rather than sitting on a task that no longer exists.

Click the **+** button in the sidebar header. Type a name, click a color swatch, and press Return. The dialog closes and the new list appears in the sidebar under Important, with a dot in the color you picked. Select it and add a task. A list you created goes to disk through the same `persist` path the seed does, and you can read it back without leaving the session:

```bash
jq '.state.lists[-1]' ~/.local/share/com.gtkx.tutorial/tasks.json
```

The name and the color you picked are both there.

## Next

Continue to [Preferences and the System Theme](/v2/tutorial/preferences-and-theming), where the app gains settings that outlive the window and follows the desktop's light or dark scheme.
