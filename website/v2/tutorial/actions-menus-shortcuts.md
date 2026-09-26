---
description: "Connect window actions, menus, shortcuts, and dialogs to the task navigator."
---

# Add Menus and Shortcuts

[Edit Tasks](/v2/tutorial/the-task-editor) added the editor route. Now give New Task one handler that its button, menu item, and accelerator can share. Add About and Keyboard Shortcuts dialogs alongside it.

## Reach navigation from window commands

The window's actions sit outside `NavigationContainer`, so they need a container ref. Add it in `src/navigation.ts`:

```diff [src/navigation.ts]
@@ -1 +1 @@
-import { createSplitViewNavigator, useNavigationState } from "@gtkx/navigation";
+import { createNavigationContainerRef, createSplitViewNavigator, useNavigationState } from "@gtkx/navigation";
```
```diff [src/navigation.ts]
@@ -10,0 +11,2 @@
+
+export const navigationRef = createNavigationContainerRef<RootParamList>();
```

Add these helpers at the end of the same file. They reuse the existing `isSelection` helper and route parameters:

```diff [src/navigation.ts]
@@ -29,0 +30,17 @@
+
+export const currentSelection = (): Selection => {
+    const routes = navigationRef.isReady() ? navigationRef.getRootState()?.routes : undefined;
+    const params = routes?.find((route) => route.name === "Tasks")?.params;
+    return isSelection(params) ? params : ALL_TASKS;
+};
+
+export const openTaskId = (): string | null => {
+    const route = navigationRef.isReady() ? navigationRef.getCurrentRoute() : undefined;
+    return route?.name === "Task" ? route.params.id : null;
+};
+
+export const openTask = (selection: Selection, id: string): void => {
+    if (!navigationRef.isReady()) return;
+    navigationRef.navigate("Tasks", selection);
+    navigationRef.navigate("Task", { id });
+};
```

`currentSelection` returns All Tasks when there is no selected content page. `openTask` first selects the list, then opens its editor, leaving the list underneath the Back button. The ref becomes usable once the container is ready.

In `src/components/window.tsx`, add `navigationRef` to the navigation import and pass it to the container:

```diff [src/components/window.tsx]
@@ -10 +10 @@
-import { ALL_TASKS, Split } from "../navigation.js";
+import { ALL_TASKS, navigationRef, Split } from "../navigation.js";
```
```diff [src/components/window.tsx]
@@ -43 +43 @@
-            <NavigationContainer>
+            <NavigationContainer ref={navigationRef}>
```

Screens keep using `useNavigation`. The container ref is for this application's handlers outside the navigation tree; the [navigation guide](/v2/guide/navigation) covers the shared API.

## Track the open dialog

Add this type to `src/types.ts`:

```diff [src/types.ts]
@@ -25,0 +26,2 @@
+
+export type DialogKind = "none" | "about" | "shortcuts";
```

In `src/store/ui.ts`, add `DialogKind` to the existing type import, then extend the slice:

```diff [src/store/ui.ts]
@@ -2 +2 @@
-import type { Filter } from "../types.js";
+import type { DialogKind, Filter } from "../types.js";
@@ -5,0 +6,2 @@
+    dialog: DialogKind;
+    showDialog: (dialog: DialogKind) => void;
@@ -17,0 +20,2 @@
+    dialog: "none",
+    showDialog: (dialog) => set({ dialog }),
```

Keep these transient fields out of the store's existing `partialize` function.

## Define the window actions

Create `src/components/window-actions.tsx`:

```tsx [src/components/window-actions.tsx]
import { GSimpleAction } from "@gtkx/jsx/gio";
import { currentSelection, openTask } from "../navigation.js";
import { useStore } from "../store/index.js";
import { addListId } from "../store/selectors.js";

export const WindowActions = () => {
    const showDialog = useStore((state) => state.showDialog);

    const newTask = (): void => {
        const { lists, addTask } = useStore.getState();
        const selection = currentSelection();
        const id = addTask(addListId(selection, lists), "New Task");
        if (id) openTask(selection, id);
    };

    return (
        <>
            <GSimpleAction name="new" onActivate={newTask} />
            <GSimpleAction name="shortcuts" onActivate={() => showDialog("shortcuts")} />
            <GSimpleAction name="about" onActivate={() => showDialog("about")} />
        </>
    );
};
```

Mounting these elements in the window's `actions` prop exposes `win.new`, `win.shortcuts`, and `win.about`. The same prop on the application exposes `app.*` actions. For the native action model, see [Gio actions](https://docs.gtk.org/gio/class.SimpleAction.html).

## Add the menu and accelerator

Create `src/components/main-menu.tsx`:

```tsx [src/components/main-menu.tsx]
import { GMenu } from "@gtkx/jsx/gio";
import { GtkMenuButton } from "@gtkx/jsx/gtk";

export const MainMenu = () => (
    <GtkMenuButton
        primary
        iconName="open-menu-symbolic"
        tooltipText="Main Menu"
        menuModel={
            <GMenu
                items={[
                    { section: [{ label: "New Task", action: "win.new" }] },
                    { section: [{ label: "Keyboard Shortcuts", action: "win.shortcuts" }] },
                    { section: [{ label: "About Tasks", action: "win.about" }] },
                ]}
            />
        }
    />
);
```

`GMenu.items` describes the menu declaratively. Its action names point to the window actions above; `primary` gives this menu button the native F10 binding.

In `src/app.tsx`, add `actionAccels` to the existing application:

```diff [src/app.tsx]
@@ -6 +6,6 @@
-        <AdwApplication>
+        <AdwApplication
+            actionAccels={[
+                { detailedActionName: "win.new", accels: ["<Control>n"] },
+                { detailedActionName: "win.shortcuts", accels: ["<Control>question"] },
+            ]}
+        >
```

The menu displays the application's registered accelerator beside New Task. GTK's [accelerator syntax](https://docs.gtk.org/gtk4/func.accelerator_parse.html) is shared by these bindings and the shortcuts below.

Update `src/components/window.tsx`. Import the button and the two new components:

```diff [src/components/window.tsx]
@@ -0,0 +1,3 @@
+import { GtkButton } from "@gtkx/jsx/gtk";
+import { MainMenu } from "./main-menu.js";
+import { WindowActions } from "./window-actions.js";
@@ -30,0 +34 @@
+            actions={<WindowActions />}
```

Add `actions={<WindowActions />}` to `AdwApplicationWindow`. In the Tasks screen's existing options, replace `headerStart` and add `headerEnd`:

```diff [src/components/window.tsx]
@@ -64 +64,11 @@
-                            headerStart: <SearchButton />,
+                            headerStart: (
+                                <>
+                                    <GtkButton
+                                        iconName="list-add-symbolic"
+                                        tooltipText="New Task (Ctrl+N)"
+                                        actionName="win.new"
+                                    />
+                                    <SearchButton />
+                                </>
+                            ),
+                            headerEnd: <MainMenu />,
```

The button's `actionName` reaches the same handler as the menu and Ctrl+N.

## Mount the dialogs {#mounting-dialogs}

Create `src/components/about.tsx`:

```tsx [src/components/about.tsx]
import * as Gtk from "@gtkx/gi/gtk";
import { AdwAboutDialog } from "@gtkx/jsx/adw";
import { applicationId } from "virtual:gtkx-config";

export const About = ({ onClose }: { onClose: () => void }) => {
    return (
        <AdwAboutDialog
            onClosed={onClose}
            applicationName="Tasks"
            applicationIcon={applicationId}
            version="1.0.0"
            developerName="GTKX"
            website="https://gtkx.dev"
            issueUrl="https://github.com/gtkx-org/gtkx/issues"
            copyright="© 2026 GTKX Contributors"
            licenseType={Gtk.License.MPL_2_0}
            developers={["GTKX Contributors"]}
            comments="A Linux task manager built with GTKX to showcase React and Adwaita."
        />
    );
};
```

`applicationId` comes from the generated project configuration, so the dialog and application shell use the same identity. The scaffold's `applicationIcon` configuration makes its icon available during development and in builds; [Package the App](/v2/tutorial/packaging) installs it with the application.

Create `src/components/shortcuts.tsx`:

```tsx [src/components/shortcuts.tsx]
import { AdwShortcutsDialog, AdwShortcutsItem, AdwShortcutsSection } from "@gtkx/jsx/adw";

export const Shortcuts = ({ onClose }: { onClose: () => void }) => (
    <AdwShortcutsDialog onClosed={onClose}>
        <AdwShortcutsSection title="General">
            <AdwShortcutsItem title="New task" accelerator="<Control>n" />
            <AdwShortcutsItem title="Search tasks" accelerator="<Control>f" />
            <AdwShortcutsItem title="Keyboard shortcuts" accelerator="<Control>question" />
        </AdwShortcutsSection>
        <AdwShortcutsSection title="Tasks">
            <AdwShortcutsItem title="Delete task" accelerator="Delete" />
            <AdwShortcutsItem title="Go back" accelerator="Escape" />
        </AdwShortcutsSection>
    </AdwShortcutsDialog>
);
```

The items describe shortcuts; they do not register them. Navigation already provides Back through Escape and Alt+Left. Search and Delete are connected below.

Create `src/components/dialogs.tsx`:

```tsx [src/components/dialogs.tsx]
import { useStore } from "../store/index.js";
import { About } from "./about.js";
import { Shortcuts } from "./shortcuts.js";

export const Dialogs = () => {
    const dialog = useStore((state) => state.dialog);
    const showDialog = useStore((state) => state.showDialog);
    const close = () => showDialog("none");

    switch (dialog) {
        case "about":
            return <About onClose={close} />;
        case "shortcuts":
            return <Shortcuts onClose={close} />;
        case "none":
            return null;
    }
};
```

Import `Dialogs` in `src/components/window.tsx` and add `<Dialogs />` after `NavigationContainer`, inside `AdwApplicationWindow`.

GTKX's dialog components present when mounted and dismiss when unmounted. `onClosed` clears the application state after a native close or Escape. The dialog stays associated with its parent window through the [portal mechanism](/v2/guide/modals-and-portals).

## Add Search and Delete shortcuts

Create `src/components/app-shortcuts.tsx`:

```tsx [src/components/app-shortcuts.tsx]
import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkCallbackAction,
    GtkShortcut,
    GtkShortcutController,
    GtkShortcutTrigger,
} from "@gtkx/jsx/gtk";
import { openTaskId } from "../navigation.js";
import { useStore } from "../store/index.js";

const shortcut = (accelerator: string, run: () => boolean) => (
    <GtkShortcut
        trigger={<GtkShortcutTrigger accelerator={accelerator} />}
        action={<GtkCallbackAction callback={run} />}
    />
);

export const AppShortcuts = () => {
    const toggleSearch = (): boolean => {
        const { searchMode, setSearchMode } = useStore.getState();
        setSearchMode(!searchMode);
        return true;
    };

    const deleteOpenTask = (): boolean => {
        const id = openTaskId();
        if (id === null) return false;
        useStore.getState().moveToTrash(id);
        return true;
    };

    return (
        <GtkShortcutController
            scope={Gtk.ShortcutScope.GLOBAL}
            shortcuts={
                <>
                    {shortcut("<Control>f", toggleSearch)}
                    {shortcut("Delete", deleteOpenTask)}
                </>
            }
        />
    );
};
```

`controllers` attaches the shortcut controller to the window. Its GLOBAL scope lets descendants use the shortcuts; returning `false` leaves an unhandled key available to the focused widget. Delete only acts when a Task route is open.

In `src/components/window.tsx`, import `AppShortcuts` and add `controllers={<AppShortcuts />}` to `AdwApplicationWindow`.

Update the editor button's tooltip in `src/components/task-buttons.tsx`:

```diff [src/components/task-buttons.tsx]
@@ -19 +19 @@
-            <GtkButton iconName="user-trash-symbolic" tooltipText="Delete" onClicked={() => moveToTrash(task.id)} />
+            <GtkButton iconName="user-trash-symbolic" tooltipText="Delete (Delete)" onClicked={() => moveToTrash(task.id)} />
```

Finish the window wiring:

```diff [src/components/window.tsx]
@@ -0,0 +1,2 @@
+import { AppShortcuts } from "./app-shortcuts.js";
+import { Dialogs } from "./dialogs.js";
@@ -33,0 +36 @@
+            controllers={<AppShortcuts />}
@@ -86,0 +90 @@
+            <Dialogs />
```

## Run it

- Press Ctrl+N from the list and from an editor. Each new task opens above its list.
- Press F10 on the task list. New Task shows Ctrl+N in the menu.
- Open Keyboard Shortcuts with Ctrl+Shift+/ on a US keyboard, then dismiss it with Escape.
- Press Escape in an editor to return to the list. In a narrow window, Back from the list returns to the sidebar.
- Press Delete with a task open. It moves to Trash; the next chapter closes its editor and offers Undo.

## Next

[Add Undo and Delete Confirmation](/v2/tutorial/trash-and-toasts) adds recoverable deletion and the New List dialog.
