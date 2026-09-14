---
description: "Add Undo, permanent-delete confirmation, and a New List dialog."
---

# Deleting Without Fear

[Menus, Accelerators, and Shortcuts](/v2/tutorial/actions-menus-shortcuts) connected the delete commands. Give them one shared handler that closes an open editor, moves the task to Trash, and offers Undo. Add permanent-delete confirmation and the New List dialog alongside it.

## Add the toast overlay

Install the GTKX collection and toast components from `tasks/`:

::: code-group

```bash [npm]
npm install @gtkx/components@beta
```

```bash [pnpm]
pnpm add @gtkx/components@beta
```

:::

In `src/components/window.tsx`, add `AdwToastOverlay` to the Adwaita element import, and add these imports:

```tsx
import { ToastProvider } from "@gtkx/components";
import { useRef } from "react";
```

Inside `Window`, create the overlay ref:

```ts
const toastOverlayRef = useRef<Adw.ToastOverlay | null>(null);
```

Wrap `AdwApplicationWindow` in `<ToastProvider overlayRef={toastOverlayRef}>`. Inside the window, wrap the existing `NavigationContainer` in `<AdwToastOverlay ref={toastOverlayRef}>`. Keep `<Dialogs />` after that overlay, inside the window.

The provider shares this overlay with `useToast`, including calls from window actions and shortcuts. See the [components guide](/v2/guide/components) for the toast API.

## Extend the persisted task actions

Add the two transitions to `TasksSlice` in `src/store/tasks.ts`:

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

Permanent deletion leaves gaps in the surviving positions. Keep additions at the end of the stored manual order by changing `addTask` in the same file:

```diff
-                    position: state.tasks.length,
+                    position: (state.tasks.at(-1)?.position ?? -1) + 1,
```

The array retains manual order: deletion removes entries, and new tasks append after its final position. An empty array starts at zero.

## Carry the task into confirmation {#confirming-a-permanent-delete}

Replace the dialog types in `src/types.ts`:

```ts
export type DialogKind = "none" | "about" | "shortcuts" | "new-list";

export type DialogState = { kind: DialogKind } | { kind: "delete-task"; task: Task };
```

Update the type import and dialog fields in `src/store/ui.ts`:

```diff
-import type { DialogKind, Filter } from "../types.js";
+import type { DialogKind, DialogState, Filter, Task } from "../types.js";

-    dialog: DialogKind;
+    dialog: DialogState;
     showDialog: (dialog: DialogKind) => void;
+    askDeleteTask: (task: Task) => void;

-    dialog: "none",
+    dialog: { kind: "none" },
-    showDialog: (dialog) => set({ dialog }),
+    showDialog: (kind) => set({ dialog: { kind } }),
+    askDeleteTask: (task) => set({ dialog: { kind: "delete-task", task } }),
```

Add this helper to `src/navigation.ts` so deleting the current task also leaves its editor:

```ts
export const closeTaskIfOpen = (id: string): void => {
    if (openTaskId() === id) navigationRef.goBack();
};
```

Create `src/components/delete-confirmation.tsx`:

```tsx
import * as Adw from "@gtkx/gi/adw";
import { AdwAlertDialog } from "@gtkx/jsx/adw";
import { closeTaskIfOpen } from "../navigation.js";
import { useStore } from "../store/index.js";
import type { Task } from "../types.js";

export const DeleteConfirmation = ({ task }: { task: Task }) => {
    const deleteForever = useStore((state) => state.deleteForever);
    const showDialog = useStore((state) => state.showDialog);

    return (
        <AdwAlertDialog
            heading="Delete Task?"
            body={`“${task.title}” will be permanently deleted. This cannot be undone.`}
            defaultResponse="cancel"
            closeResponse="cancel"
            responses={[
                { id: "cancel", label: "Cancel" },
                { id: "delete", label: "Delete", appearance: Adw.ResponseAppearance.DESTRUCTIVE },
            ]}
            onResponse={(id) => {
                if (id === "delete") {
                    closeTaskIfOpen(task.id);
                    deleteForever(task.id);
                }
                showDialog("none");
            }}
        />
    );
};
```

Cancel is both the default and close response. Delete uses Adwaita's destructive appearance and removes the task only after confirmation.

## Add the New List dialog {#a-dialog-that-is-a-form}

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
                {
                    id: "add",
                    label: "Add",
                    appearance: Adw.ResponseAppearance.SUGGESTED,
                    isEnabled: name.trim().length > 0,
                },
            ]}
            onResponse={(id) => {
                if (id === "add") addList(name.trim(), color);
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

The native Add response is disabled until the name has content. Its handler trims the accepted name, so `addList` in `src/store/lists.ts` can use it directly:

```ts
addList: (name, color) =>
    set((state) => ({ lists: [...state.lists, { id: crypto.randomUUID(), name, color }] })),
```

## Share the delete command

Replace `src/components/dialogs.tsx` with the shared deletion hook and dialog selection:

```tsx
import { useToast } from "@gtkx/components";
import { useStore } from "../store/index.js";
import { About } from "./about.js";
import { DeleteConfirmation } from "./delete-confirmation.js";
import { NewListDialog } from "./new-list-dialog.js";
import { Shortcuts } from "./shortcuts.js";
import { closeTaskIfOpen } from "../navigation.js";
import type { Task } from "../types.js";

export const useRequestDeleteTask = (): ((task: Task) => void) => {
    const { show } = useToast();

    return (task) => {
        const { moveToTrash, restore, askDeleteTask } = useStore.getState();
        if (task.deleted) {
            askDeleteTask(task);
            return;
        }
        closeTaskIfOpen(task.id);
        moveToTrash(task.id);
        show({
            useMarkup: false,
            title: `“${task.title}” moved to Trash`,
            buttonLabel: "Undo",
            onButtonClicked: () => restore(task.id),
        });
    };
};

export const Dialogs = () => {
    const dialog = useStore((state) => state.dialog);
    const showDialog = useStore((state) => state.showDialog);
    const close = (): void => showDialog("none");

    switch (dialog.kind) {
        case "about":
            return <About onClose={close} />;
        case "shortcuts":
            return <Shortcuts onClose={close} />;
        case "new-list":
            return <NewListDialog />;
        case "delete-task":
            return <DeleteConfirmation task={dialog.task} />;
        case "none":
            return null;
    }
};
```

`useMarkup: false` keeps a task title literal, including ampersands and angle brackets. Undo restores the persisted task; the confirmation body also uses plain text by default.

In `TaskRow` and `TaskButtons`, import `useRequestDeleteTask` from `./dialogs.js`, replace their `moveToTrash` store subscription with `const requestDeleteTask = useRequestDeleteTask()`, and call `requestDeleteTask(task)` from the delete buttons.

In `src/components/app-shortcuts.tsx`, import the same hook and call it inside `AppShortcuts`. Replace `deleteOpenTask` with a handler that reads the current task:

```ts
const requestDeleteTask = useRequestDeleteTask();

const deleteOpenTask = (): boolean => {
    const task = useStore.getState().tasks.find((candidate) => candidate.id === openTaskId());
    if (!task) return false;
    requestDeleteTask(task);
    return true;
};
```

In `Window`, read `const showDialog = useStore((state) => state.showDialog)` and update the Lists screen header:

```tsx
<Split.Screen
    name="Lists"
    component={Sidebar}
    options={{
        title: "Tasks",
        headerStart: (
            <GtkButton
                iconName="list-add-symbolic"
                tooltipText="New List"
                onClicked={() => showDialog("new-list")}
            />
        ),
    }}
/>
```

## Run it

Delete from a row, its editor, and the Delete key. Each path offers Undo and closes the editor when needed. Try a title containing `&` or `<b>`: the toast preserves the text.

Open Trash and delete again. Cancel and Escape preserve the task; Delete removes it permanently. Add another task afterward and check that it appears last in manual order.

Open New List. Add stays disabled for an empty or whitespace-only name. Enter a name, choose a color, and press Return; the saved list appears in the sidebar.

## Next

[Preferences and the System Theme](/v2/tutorial/preferences-and-theming) stores application choices in GSettings.
