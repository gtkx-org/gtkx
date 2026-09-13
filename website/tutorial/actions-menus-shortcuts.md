---
description: "Name the app's commands as GActions, reach them from a menu and the keyboard, and drive the navigator from outside a screen."
---

# Menus, Accelerators, and Shortcuts

The editor from [Opening a Task](/tutorial/the-task-editor) is ready for keyboard and menu commands. This chapter adds native GActions that buttons, menu items, and accelerators can share, plus shortcuts for search and deletion.

## Commands as actions

Declare the window's commands with `GSimpleAction` elements, grouped in a component.

Create `src/components/window-actions.tsx`:

```tsx
import { GSimpleAction } from "@gtkx/jsx/gio";
import { currentSelection, openTask } from "../navigation.js";
import { useStore } from "../store/index.js";
import { addListId } from "../store/selectors.js";

export const WindowActions = () => {
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

Some names are missing, so this file does not compile on its own. `showDialog` joins the store below, where the finished file appears. `currentSelection` and `openTask` are the subject of the next section.

`newTask` reads the store when activated. It gets the current selection from navigation state through a helper added below.

Mount the group in the window's `actions` slot. In `src/components/window.tsx`:

```tsx
import { WindowActions } from "./window-actions.js";

// ...

<AdwApplicationWindow
    title="Tasks"
    widthRequest={360}
    heightRequest={294}
    onCloseRequest={() => quit()}
    breakpoints={/* ... */}
    actions={<WindowActions />}
>
    {/* ... */}
</AdwApplicationWindow>
```

Mounting `name="new"` in the window's `actions` slot makes it available as `win.new`. The application's slot uses the `app` prefix instead. These commands operate on this window, so they use `win`.

Once a command has a name, a widget can point at it instead of carrying a handler. The New Task button belongs on the task list's header bar, which is the `Tasks` screen's `headerStart` option. In `src/components/window.tsx`:

```diff
+import { GtkButton } from "@gtkx/jsx/gtk";
```

```diff
 options={({ route }) => ({
     title: selectionTitle(route.params, lists),
     headerTitle: <TaskFilter />,
-    headerStart: <SearchButton />,
+    headerStart: (
+        <>
+            <GtkButton
+                iconName="list-add-symbolic"
+                tooltipText="New Task (Ctrl+N)"
+                actionName="win.new"
+            />
+            <SearchButton />
+        </>
+    ),
 })}
```

`actionName` connects the button to the action without an `onClicked` handler. GTK controls its sensitivity from the action's availability and enabled state.

## Reaching the navigator from outside a screen

Window actions are outside the navigator's screen tree. Use a [navigation ref](https://reactnavigation.org/docs/navigation-ref/) to reach the container from their handlers. GTKX re-exports `createNavigationContainerRef` alongside its navigators.

In `src/navigation.ts`:

```diff
-import { createSplitViewNavigator, useNavigationState } from "@gtkx/navigation";
+import { createNavigationContainerRef, createSplitViewNavigator, useNavigationState } from "@gtkx/navigation";
```

```diff
 export const Split = createSplitViewNavigator<RootParamList>();
+
+export const navigationRef = createNavigationContainerRef<RootParamList>();
```

The ref exposes the container's navigation methods, typed against `RootParamList`. Add the helpers this app needs at the end of the file:

```ts
export const currentSelection = (): Selection => {
    const routes = navigationRef.isReady() ? navigationRef.getRootState()?.routes : undefined;
    const params = routes?.find((route) => route.name === "Tasks")?.params;
    return isSelection(params) ? params : ALL_TASKS;
};

export const openTaskId = (): string | null => {
    const route = navigationRef.isReady() ? navigationRef.getCurrentRoute() : undefined;
    return route?.name === "Task" ? route.params.id : null;
};

export const openTask = (selection: Selection, id: string): void => {
    if (!navigationRef.isReady()) return;
    navigationRef.navigate("Tasks", selection);
    navigationRef.navigate("Task", { id });
};
```

The helpers check `isReady()` because application actions can arrive before the navigation container mounts. [Reminders That Reach the Desktop](/tutorial/reminders) handles that startup case for desktop notifications.

`currentSelection` falls back to All Tasks when the content stack has no selection.

`openTaskId` returns the editor's task id, or `null` on other routes. The Delete shortcut uses it below.

`openTask` selects a list before opening the editor, giving the back button a task list to return to.

Hand the container the ref. In `src/components/window.tsx`:

```diff
-import { ALL_TASKS, Split } from "../navigation.js";
+import { ALL_TASKS, navigationRef, Split } from "../navigation.js";
```

```diff
-<NavigationContainer>
+<NavigationContainer ref={navigationRef}>
```

Keep using screen props and `useNavigation` inside the navigator.

## Accelerators

Set `actionAccels` on `AdwApplication` to bind keys to actions. A `win` action resolves against the active window.

In `src/app.tsx`:

```tsx
<AdwApplication
    actionAccels={[
        { detailedActionName: "win.new", accels: ["<Control>n"] },
        { detailedActionName: "win.shortcuts", accels: ["<Control>question"] },
    ]}
>
    <Window />
</AdwApplication>
```

GTK uses these accelerator strings for both keyboard activation and the hints displayed beside menu items.

## The primary menu

A GNOME primary menu is a `GtkMenuButton` in the header bar whose model is a menu of action names.

Create `src/components/main-menu.tsx`:

```tsx
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

The `GMenu` element builds a native menu model from these items. Each section separates a group of commands, and each item names the action it activates. GTK controls menu item sensitivity from those actions.

`primary` marks this button as the window's primary menu, which is what makes F10 open it. You do not register that key yourself.

Put it at the other end of the task list's header bar, in the same options object. In `src/components/window.tsx`:

```diff
+import { MainMenu } from "./main-menu.js";
```

```diff
 options={({ route }) => ({
     // ...
+    headerEnd: <MainMenu />,
 })}
```

The editor page fills its own header with the task's title and its buttons, so the menu belongs to the task list's bar alone.

## Mounting dialogs

Track which dialog is open in the UI slice.

In `src/types.ts`:

```ts
export type DialogKind = "none" | "about" | "shortcuts";
```

In `src/store/ui.ts`, add the field to the slice type and to the creator:

```ts
export type UiSlice = {
    // ...
    dialog: DialogKind;
    // ...
    showDialog: (dialog: DialogKind) => void;
};

export const createUiSlice: StateCreator<Store, Mutators, [], UiSlice> = (set) => ({
    // ...
    dialog: "none",
    // ...
    showDialog: (dialog) => set({ dialog }),
});
```

`dialog` describes what is on screen right now, so leave it out of `partialize`. A dialog that was open when you quit should not reappear on the next launch.

`window-actions.tsx` can now read that setter, which finishes the file:

```tsx
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

One component renders whichever dialog the store names. Create `src/components/dialogs.tsx`:

```tsx
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

GTKX's dialog components present when mounted and dismiss when unmounted. Change the store's `dialog` field to control which one is shown.

`Dialogs` can sit alongside the navigator inside the window. The dialog components use a portal and present against their containing window, without changing the navigation stack. See [Modals and Portals](/guide/modals-and-portals) for other presentation patterns.

`onClosed` clears the state that mounted the dialog. That signal fires whichever way the dialog goes away, including Escape and the close button, so routing it back to `showDialog("none")` keeps the store's `dialog` field in sync with what is on screen.

Create `src/components/about.tsx`:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { AdwAboutDialog } from "@gtkx/jsx/adw";

export const About = ({ onClose }: { onClose: () => void }) => {
    return (
        <AdwAboutDialog
            onClosed={onClose}
            applicationName="Tasks"
            applicationIcon="com.gtkx.tutorial"
            version="1.0.0"
            developerName="GTKX"
            website="https://gtkx.dev"
            issueUrl="https://github.com/gtkx-org/gtkx/issues"
            copyright="© 2026 GTKX Contributors"
            licenseType={Gtk.License.MPL_2_0}
            developers={["GTKX Contributors"]}
            comments="A GNOME task manager built with GTKX to showcase React and Adwaita."
        />
    );
};
```

`applicationIcon` uses the app's icon name. This tutorial uses `com.gtkx.tutorial`; if you chose another application ID, use it here too. [Appendix B](/tutorial/packaging) installs the icon alongside the app.

Create `src/components/shortcuts.tsx`:

```tsx
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

Adwaita displays each `accelerator` as key caps. These items describe shortcuts; their handlers come from `actionAccels`, the controller below, or the navigator's built-in back behavior.

Mount `Dialogs` inside the window. In `src/components/window.tsx`:

```tsx
import { Dialogs } from "./dialogs.js";

// ...

<AdwApplicationWindow
    // ...
    actions={<WindowActions />}
>
    {/* ... */}
    <Dialogs />
</AdwApplicationWindow>
```

## View-specific shortcuts

For this app's search and delete keys, use callback shortcuts on a `GtkShortcutController` in the window's `controllers` slot. The delete handler can leave the key unhandled when no task is open.

Create `src/components/app-shortcuts.tsx`:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { GtkShortcut, GtkShortcutController } from "@gtkx/jsx/gtk";
import { openTaskId } from "../navigation.js";
import { useStore } from "../store/index.js";

const shortcut = (accelerator: string, run: () => boolean) => (
    <GtkShortcut trigger={Gtk.ShortcutTrigger.parseString(accelerator)} action={Gtk.CallbackAction.new(run)} />
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

A shortcut pairs a trigger with an action. `Gtk.ShortcutTrigger.parseString` reads the same accelerator strings you have been writing, and `Gtk.CallbackAction.new` wraps a function whose return value reports what happened to the key.

`scope={Gtk.ShortcutScope.GLOBAL}` makes these fire wherever focus sits inside the window. Leave it out and the keys work only while focus is on the controller's own widget, which for a window-level controller is almost never what you want.

Returning `false` leaves the key unhandled. On the task list, `openTaskId()` returns `null`, so Delete remains available to the focused widget. Returning `true` marks a shortcut as handled.

Leave Escape to the navigator's native back behavior.

Mount the controller in `src/components/window.tsx`:

```diff
+import { AppShortcuts } from "./app-shortcuts.js";
```

```diff
     actions={<WindowActions />}
+    controllers={<AppShortcuts />}
 >
```

Delete now has a key behind it, so the trash button in the open task's header can name it the way the New Task button does. In `src/components/task-buttons.tsx`:

```diff
 <GtkButton
     iconName="user-trash-symbolic"
-    tooltipText="Delete"
+    tooltipText="Delete (Delete)"
     onClicked={() => moveToTrash(task.id)}
 />
```

## Run it

Save the files and try the keyboard.

- Press `Ctrl+N`. A task called "New Task" is added and the editor opens on it, with the title field ready. Press `Ctrl+N` again from inside the editor and it swaps to the newer task, with the list still under both of them.
- Press `F10`, or click the menu button at the end of the task list header. The primary menu opens, and the New Task item shows `Ctrl+N` along its right-hand edge.
- Press `Ctrl+question` (`Ctrl+Shift+/` on a US layout). The keyboard shortcuts dialog appears. Press `Escape` to dismiss it, then press `Ctrl+question` again to bring it back.
- With a task open, press `Escape` to return to the list. Press `Escape` on the task list and nothing happens while both panes are visible. Drag the window narrow and the same key takes you back to the sidebar.
- With a task open, press `Delete`. The task moves to Trash, with no warning and the editor still on it. [Deleting Without Fear](/tutorial/trash-and-toasts) closes that gap next.

## Next

[Deleting Without Fear](/tutorial/trash-and-toasts) gives the app an undo toast and a confirmation dialog, so a deleted task can be brought back.
