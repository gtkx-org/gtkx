---
description: "Make deletion recoverable with an Undo toast, a confirmation dialog, and a Trash you can empty."
---

# Deleting Without Fear

[Menus, Accelerators, and Shortcuts](/tutorial/actions-menus-shortcuts) connected every delete command, but moving a task to Trash still leaves its editor open and offers no way back. This chapter adds one deletion path for the row button, header button, and Delete key. It also adds the New List dialog promised in [Lists and a Sidebar](/tutorial/lists-and-the-sidebar).

## Add the undo toast

`@gtkx/components` connects imperative Adwaita toasts to a declarative GTKX tree. Install it from `tasks/`:

::: code-group

```bash [npm]
npm install @gtkx/components
```

```bash [pnpm]
pnpm add @gtkx/components
```

:::

In `src/components/window.tsx`, share an overlay ref with `ToastProvider` and wrap the navigator with the corresponding `AdwToastOverlay`:

```diff
+import { ToastProvider } from "@gtkx/components";
 import * as Adw from "@gtkx/gi/adw";
-import { AdwApplicationWindow, AdwBreakpoint, AdwStatusPage } from "@gtkx/jsx/adw";
+import { AdwApplicationWindow, AdwBreakpoint, AdwStatusPage, AdwToastOverlay } from "@gtkx/jsx/adw";
 import { useRef } from "react";

 const windowRef = useRef<Adw.ApplicationWindow | null>(null);
+const toastOverlayRef = useRef<Adw.ToastOverlay | null>(null);

-<AdwApplicationWindow ref={windowRef}>
-    <NavigationContainer ref={navigationRef}>
-        <Split.Navigator>
-            …
-        </Split.Navigator>
-    </NavigationContainer>
-    <Dialogs />
-</AdwApplicationWindow>
+<ToastProvider overlayRef={toastOverlayRef}>
+    <AdwApplicationWindow ref={windowRef}>
+        <AdwToastOverlay ref={toastOverlayRef}>
+            <NavigationContainer ref={navigationRef}>
+                <Split.Navigator>
+                    …
+                </Split.Navigator>
+            </NavigationContainer>
+        </AdwToastOverlay>
+        <Dialogs />
+    </AdwApplicationWindow>
+</ToastProvider>
```

The provider makes this overlay available to `useToast`, including from the window's shortcut controller. The overlay stays around the navigator because that is the surface the toast should cover. See the [components guide](/guide/components) for the toast helpers and React's [context guide](https://react.dev/learn/passing-data-deeply-with-context) for the underlying React pattern.

Add the two remaining task transitions in `src/store/tasks.ts`:

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

Moving and restoring change the persisted `deleted` flag. Permanent deletion removes the task from the same persisted array.

## Model the confirmation

The dialog state must carry the task whenever a permanent-delete dialog is open. Replace the string-only dialog model in `src/types.ts`:

```ts
export type DialogKind = "none" | "about" | "shortcuts" | "new-list";

export type DialogState = { kind: DialogKind } | { kind: "delete-task"; task: Task };
```

This TypeScript [discriminated union](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions) keeps the task on the only dialog state that needs it, without a nullable fallback.

Update the UI slice in `src/store/ui.ts`:

```ts
export type UiSlice = {
    collapsed: boolean;
    filter: Filter;
    searchMode: boolean;
    searchQuery: string;
    dialog: DialogState;
    setCollapsed: (collapsed: boolean) => void;
    setFilter: (filter: Filter) => void;
    setSearchMode: (searchMode: boolean) => void;
    setSearchQuery: (searchQuery: string) => void;
    resetSearch: () => void;
    showDialog: (kind: DialogKind) => void;
    askDeleteTask: (task: Task) => void;
};

export const createUiSlice: StateCreator<Store, Mutators, [], UiSlice> = (set) => ({
    collapsed: false,
    filter: "all",
    searchMode: false,
    searchQuery: "",
    dialog: { kind: "none" },
    setCollapsed: (collapsed) => set({ collapsed }),
    setFilter: (filter) => set({ filter }),
    setSearchMode: (searchMode) => set({ searchMode }),
    setSearchQuery: (searchQuery) => set({ searchQuery }),
    resetSearch: () => set({ searchMode: false, searchQuery: "" }),
    showDialog: (kind) => set({ dialog: { kind } }),
    askDeleteTask: (task) => set({ dialog: { kind: "delete-task", task } }),
});
```

This shape makes the invalid state—an open confirmation with no task—impossible.

Deleting an open task must also remove its editor. Add this helper to `src/navigation.ts`:

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

The response IDs keep the native dialog and the handler aligned. Cancel is both the default and close response, while Delete uses Adwaita's destructive appearance.

## Route every delete through one hook

Add the shared command to `src/components/dialogs.tsx`:

```tsx
import { useToast } from "@gtkx/components";
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
            title: `“${task.title}” moved to Trash`,
            buttonLabel: "Undo",
            onButtonClicked: () => restore(task.id),
        });
    };
};
```

Use this hook in `TaskRow`, `TaskButtons`, and `AppShortcuts`, then replace each direct `moveToTrash` call with `requestDeleteTask(task)`. The handler reads current store actions when it runs and uses the one overlay shared by the window.

Mount the confirmation from the same file. `Dialogs` now switches on `dialog.kind`:

```tsx
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

## Add the New List dialog

The New List dialog owns its unfinished name and color. Create `src/components/new-list-dialog.tsx`:

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

The Add response remains disabled until the trimmed name has content. The store can now trust its caller, so simplify `addList` in `src/store/lists.ts`:

```ts
addList: (name, color) =>
    set((state) => ({ lists: [...state.lists, { id: crypto.randomUUID(), name, color }] })),
```

Add the `new-list` case shown above, then open it from the Lists screen header in `src/components/window.tsx`:

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

Delete a task from a row, its editor, and the Delete key. Each route closes an open editor, moves the task to Trash, and offers Undo. Deleting from Trash opens the confirmation; Cancel and Escape preserve the task, while Delete removes it permanently.

Open the New List dialog. Add stays disabled for an empty or whitespace-only name. Enter a name, choose a swatch, and press Return. The list appears in the sidebar and is saved with the other user data.

## Next

[Preferences and the System Theme](/tutorial/preferences-and-theming) adds settings that survive the window and can follow the desktop's color scheme.
