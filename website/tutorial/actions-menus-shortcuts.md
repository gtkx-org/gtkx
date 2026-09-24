---
description: "Name the app's commands as GActions, reach them from a menu and the keyboard, and drive the navigator from outside a screen."
---

# Menus, Accelerators, and Shortcuts

In [Opening a Task](/tutorial/the-task-editor) an open task became a route, so a row navigates into the editor and the navigator's own back button leaves it. Every command still needs the pointer, and the header bar is running out of room for buttons.

Take the new-task button. A GNOME app exposes that same command from the button, the primary menu, and a key, and you do not want a copy of the handler for each. Name the command once and let all of them refer to it by name. That name is a GAction.

## Commands as actions

An action is a named, activatable command that belongs to either the window or the application. GTKX exposes actions as elements, so a group of them is an ordinary component.

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

`newTask` reaches the store through `useStore.getState()` rather than a hook. The handler reads the state at the moment it runs, so the component does not re-render when the lists change. The store is not React state, as [Adding Tasks with a Store](/tutorial/the-task-store) covered, so any function can read it directly.

The selection is not there to read. Since [Lists and a Sidebar](/tutorial/lists-and-the-sidebar) it has been the `Tasks` route's params, and this handler runs from a menu item, a key, and a button, none of which is inside a screen. There is no `route` prop to take it from and no `useNavigation` to call, so the handler asks the navigator the same way it asks the store: through a module-level function.

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

**The scope prefix comes from the mount point, not from the name.** The element says `name="new"`, and mounting it in the window's `actions` slot makes the full name `win.new`. The same element in the application's `actions` slot becomes `app.new`. A command that needs a window to act on belongs on the window; a command that makes sense with no window open belongs on the application.

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

`actionName` takes the place of `onClicked`, and GTK4 dims the button whenever no window offers that action. It also answers the rule [Smart Views, Filters, and Search](/tutorial/smart-views-and-search) set for header widgets, which sent the filter and the search button into components of their own: this button watches nothing, so putting it straight in the options costs `Window` no renders.

## Reaching the navigator from outside a screen

`useNavigation` answers only below a screen. A GAction handler is not below one, and neither is a window shortcut or a notification handler, so the navigator needs a handle a plain module can hold. `createNavigationContainerRef` makes one, and the container takes it as its `ref`.

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

The ref exposes the navigation API a screen gets from its `navigation` prop, typed against the same `RootParamList`. Add the questions this app asks it, at the end of the file:

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

Every one of them starts at `isReady()`. Between this module loading and the container's first render the ref points at nothing, and an action can arrive in that gap: [Reminders That Reach the Desktop](/tutorial/reminders) lets the desktop start the app to deliver one. Calling through the ref before the container is mounted reports an error and does nothing, so each helper checks first and answers with a fallback.

`currentSelection` reads the params `useSelection` reads inside the tree, off the root state rather than off a hook. It falls back to All Tasks because the content stack can be empty, the Nothing Selected state from [A Layout That Collapses](/tutorial/an-adaptive-layout).

`openTaskId` asks which route the user is looking at and answers `null` for every route but `Task`. Which task is open is a fact the navigator already holds, so no field anywhere mirrors it, and this one question is what gates the Delete key below.

`openTask` navigates twice on purpose. The first call selects the task list you name and drops whatever page sat above it, the second pushes the task's page onto that list. The editor then has a list underneath it, so leaving the editor lands somewhere that makes sense rather than wherever the app happened to be.

Hand the container the ref. In `src/components/window.tsx`:

```diff
-import { ALL_TASKS, Split } from "../navigation.js";
+import { ALL_TASKS, navigationRef, Split } from "../navigation.js";
```

```diff
-<NavigationContainer>
+<NavigationContainer ref={navigationRef}>
```

There is one container, so there is one ref, and it is the only way in from outside. Screens keep using `useNavigation` and their `route`; the ref exists for the code that has neither.

## Accelerators

An accelerator maps a key combination to an action name. Accelerators register on the application even when they point at window-scoped actions, because the application owns the keyboard mapping. The name still resolves against whichever window has focus, so `win.new` fires the action of the window you are looking at.

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

`accels` is an array because one action can answer to several combinations. The string form (`<Control>n`, `<Shift><Control>Delete`, `F10`) is what GTK4 parses everywhere, and a menu item reads it to draw `Ctrl+N` along its right-hand edge. Write the accelerator once and the menu label follows.

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

`GMenu` takes an `items` array instead of the imperative `append`/`appendSection`/`appendSubmenu` calls. An entry with `section` groups its children and draws a separator between groups, an entry with `submenu` opens a nested menu, and an entry with `label` and `action` is a menu item. The action name is all the wiring it needs: no callback threaded down from the window, and the item goes insensitive by itself when the action is missing.

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

Menu items open dialogs, so the store has to track which dialog is showing. A dialog is a state, not an event: it is either open or closed, so one field describes it.

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

**This is the dialog contract, and every dialog in the rest of the tutorial follows it.** Mounting the component presents the dialog, unmounting it dismisses the dialog. You never call `present` or `close`. You change `dialog` in the store and the reconciler does the rest.

The widget an Adwaita dialog element creates is not laid out inside the surrounding widget tree, so it does not matter that `Dialogs` sits at the bottom of the window's children, outside the navigator. It renders through a portal, presented against the window that contains it, and presenting one leaves the content stack exactly as it was. [Modals and Portals](/guide/modals-and-portals) covers the general mechanism, including `createPortal` for the cases you drive by hand.

`onClosed` clears the state that mounted the dialog. That signal fires whichever way the dialog goes away, including Escape and the close button, so routing it back to `showDialog("none")` keeps the store's `dialog` field in sync with what is on screen.

Both dialogs are plain Adwaita: each takes the callback and does nothing else.

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

`applicationIcon` is an icon name, and it is the application ID you chose when you scaffolded the project. Nothing is drawn there until the icon is installed alongside the app, which happens in [Appendix B](/tutorial/packaging).

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

`accelerator` takes the same string form as `actionAccels`, and Adwaita draws it as key caps. This dialog is documentation rather than wiring: adding an item here does not create the key. Delete is the one you add next. Escape already works, because the navigator gives every content page a back gesture and a key that pops it.

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

## Keys that are not commands

Search and delete need keys too, and neither belongs in a menu. Search is a view state rather than a command, and "Delete task" means nothing with no task open.

**A command you would put in a menu is an action. A key that only makes sense in a particular view state is a shortcut.** Actions are global, named, and discoverable. Shortcuts are local, anonymous, and conditional.

Shortcuts live on a `GtkShortcutController`, which mounts in the window's `controllers` slot.

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

**A shortcut that does not act returns `false`, so the key keeps travelling.** That is the whole gate on Delete. `openTaskId()` is `null` on every route but `Task`, so on the task list the callback finds nothing to delete and reports the key as unhandled, leaving Delete to whatever else wants it. The trigger never changes, so the controller builds its shortcuts once and keeps them for the life of the window.

Escape is missing from that list on purpose. Popping a page is the navigator's own behaviour, bound to Escape, `Alt` + `Left`, the mouse back button, and the edge swipe alike, so a shortcut of yours claiming Escape would only get in its way.

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

The back button beside it needs nothing: Adwaita draws it, labels it, and gives it the key.

## Run it

Save the files and try the keyboard.

- Press `Ctrl+N`. A task called "New Task" is added and the editor opens on it, with the title field ready. Press `Ctrl+N` again from inside the editor and it swaps to the newer task, with the list still under both of them.
- Press `F10`, or click the menu button at the end of the task list header. The primary menu opens, and the New Task item shows `Ctrl+N` along its right-hand edge.
- Press `Ctrl+question` (`Ctrl+Shift+/` on a US layout). The keyboard shortcuts dialog appears. Press `Escape` to dismiss it, then press `Ctrl+question` again to bring it back.
- With a task open, press `Escape`. The editor closes and the list is showing again, from code you did not write. Press `Escape` on the task list and nothing happens while both panes are visible. Drag the window narrow and the same key takes you back to the sidebar.
- With a task open, press `Delete`. The task moves to Trash, with no warning and the editor still on it. [Deleting Without Fear](/tutorial/trash-and-toasts) closes that gap next.

## Next

[Deleting Without Fear](/tutorial/trash-and-toasts) gives the app an undo toast and a confirmation dialog, so a deleted task can be brought back.
