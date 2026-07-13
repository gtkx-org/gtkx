---
description: "GActions in a React app: declare named commands once, then drive them from menus, keyboard accelerators, and toolbar buttons."
---

# Actions, Menus, and Shortcuts

In a React web app, a click handler is wired straight to a button. GTK pulls those two apart. A **GAction** is a named, addressable command ("new", "preferences", "open-task") that lives in an *action map*, and buttons, menu items, keyboard accelerators, and even desktop notifications all reference that command by a string name. Define the behavior once, trigger it from anywhere.

Tasks uses this everywhere its commands need more than one entry point. The hamburger menu item and the `Ctrl+N` accelerator both resolve the same `win.new` action, and the "New Task" toolbar button calls the very handler that action wraps. This page walks through how the app declares those actions, gives them keyboard shortcuts, builds the menu, and layers on view-local shortcuts that a GAction would be the wrong tool for.

## Two scopes: `win.*` and `app.*`

Every action string carries a scope prefix. Tasks uses both:

- **`win.*`** actions belong to the window. They are the app's real commands (new task, preferences, about) and their accelerators only fire while that window has focus. They live in the window's `actions` slot.
- **`app.*`** actions belong to the application itself. Tasks uses them only for the two commands a desktop notification fires ("Mark Complete", "Open"), because a notification is delivered to the whole application, not to any particular window, and may arrive when no window is even open. They live as children of `<AdwApplication>`.

The scope prefix is not cosmetic: it selects *which* action map GTK looks in when it resolves a `detailed-action-name` from a menu item or a notification button.

## Window actions: `<GSimpleAction>` in the `actions` slot

`GSimpleAction` is the concrete GAction you instantiate. In gtkx it is a declarative host component from `@gtkx/jsx/gio`, so you mount actions as JSX and let them come and go with your component tree. Each one takes a `name` and an `onActivate` handler that runs when the action fires.

Tasks groups the five window commands into one `WindowActions` component:

```tsx
import { GSimpleAction } from "@gtkx/jsx/gio";

const WindowActions = ({
    onNew,
    onSelect,
    onPreferences,
    onShortcuts,
    onAbout,
}: {
    onNew: () => void;
    onSelect: () => void;
    onPreferences: () => void;
    onShortcuts: () => void;
    onAbout: () => void;
}) => (
    <>
        <GSimpleAction name="new" onActivate={onNew} />
        <GSimpleAction name="select" onActivate={onSelect} />
        <GSimpleAction name="preferences" onActivate={onPreferences} />
        <GSimpleAction name="shortcuts" onActivate={onShortcuts} />
        <GSimpleAction name="about" onActivate={onAbout} />
    </>
);
```

The scope prefix comes from *where* you mount these, not from the `name`. `AdwApplicationWindow` exposes an `actions` slot backed by the window's `addAction`, so a `<GSimpleAction name="new">` placed there becomes `win.new`:

```tsx
<AdwApplicationWindow
    ref={windowRef}
    title="Tasks"
    // ...
    actions={
        <WindowActions
            onNew={newTask}
            onSelect={enterSelection}
            onPreferences={() => setShowPreferences(true)}
            onShortcuts={() => setShowShortcuts(true)}
            onAbout={() => setShowAbout(true)}
        />
    }
    controllers={/* view shortcuts, below */}
>
```

Because the handlers close over the window component's state setters (`setShowPreferences`, `setShowAbout`, ...), firing `win.preferences` from *any* source (menu click, accelerator, a future button) just flips React state. The action is the single seam between "a command was requested" and "here is what that does".

::: tip
The `onActivate` handler receives `(parameter, self)`, where `parameter` is a `GLib.Variant | null`. The five window actions here are parameterless, so they ignore it. The two application actions below use it.
:::

## Accelerators: `actionAccels` on `<AdwApplication>`

An action has no keyboard shortcut until you register an accelerator for it. That registration is application-global, so it lives on `<AdwApplication>`, not on the window. gtkx surfaces it as the declarative `actionAccels` prop: an array mapping a `detailedActionName` to a list of accelerator strings.

```tsx
<AdwApplication
    actionAccels={[
        { detailedActionName: "win.new", accels: ["<Control>n"] },
        { detailedActionName: "win.preferences", accels: ["<Control>comma"] },
        { detailedActionName: "win.shortcuts", accels: ["<Control>question"] },
    ]}
>
    {/* application actions + window, below */}
</AdwApplication>
```

Note that these `detailedActionName`s are `win.*`: the accelerator is registered at the application level but points at a window-scoped action, so the shortcut only fires while a window owning a `new` / `preferences` / `shortcuts` action is focused. The accelerator strings use GTK's parser syntax: `<Control>`, `<Shift>`, `<Alt>`, plus a key name (`comma`, `question`, `n`). `<Control>question` is the conventional GNOME "keyboard shortcuts" binding.

Not every action needs an accelerator. `win.select` and `win.about` are reachable only from the menu, so they are simply absent from `actionAccels`.

## Application actions for notifications

The two `app.*` actions are direct children of `<AdwApplication>`, which routes them into the application's own action map. They exist so a desktop notification has something to invoke:

```tsx
import * as GLib from "@gtkx/gi/glib";

<AdwApplication actionAccels={/* ... */}>
    <GSimpleAction
        name="complete-task"
        parameterType={GLib.VariantType.new("s")}
        onActivate={(parameter) => {
            if (parameter) notify.current.complete(parameter.getString()[0]);
        }}
    />
    <GSimpleAction
        name="open-task"
        parameterType={GLib.VariantType.new("s")}
        onActivate={(parameter) => {
            if (parameter) notify.current.open(parameter.getString()[0]);
        }}
    />
    <TasksWindow notify={notify} />
</AdwApplication>
```

Unlike the window actions, these declare a `parameterType` of `"s"` (a `GLib.VariantType` for a string): the action carries a task id as its payload. `onActivate` reads it back with `parameter.getString()[0]` and hands it to the live window through a ref (`notify.current`), because the notification may arrive while React state lives inside the window subtree.

The notification itself is built in `notifications.ts` and names those actions by their fully scoped strings:

```ts
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";

export const buildReminder = (task: Task): Gio.Notification => {
    const notification = Gio.Notification.new(task.title);
    notification.setBody(`Due ${formatDateTime(task.due)}`);
    notification.setPriority(Gio.NotificationPriority.HIGH);
    notification.addButtonWithTarget("Mark Complete", "app.complete-task", GLib.Variant.newString(task.id));
    notification.setDefaultActionAndTarget("app.open-task", GLib.Variant.newString(task.id));
    return notification;
};
```

`setDefaultActionAndTarget` is what runs when the user clicks the notification body; `addButtonWithTarget` adds an inline "Mark Complete" button. Both pass the task id as the `GLib.Variant` target that arrives in `onActivate`. Sending it is one call on the `Gtk.Application` returned by `useApplication()`:

```tsx
const app = useApplication();
const sendReminder = useCallback((task: Task) => app.sendNotification(task.id, buildReminder(task)), [app]);
```

This is the whole reason `app.*` exists in this app: a notification button must reference an action that is alive independent of any window, so those two actions sit on the application and everything else sits on the window.

## The primary menu: `<GtkMenuButton>` + declarative `<Menu>`

The hamburger button in the header bar is a `GtkMenuButton` whose popup is a `GMenu` model, not a tree of widgets. A GMenu is a pure data model of labels and action names; GTK renders it into the actual popover for you. gtkx's `Menu` component (from `@gtkx/components`) builds that `Gio.Menu` from a plain array, and you hand it to the button's `menuModel` slot:

```tsx
import { Menu } from "@gtkx/components";
import { GtkMenuButton } from "@gtkx/jsx/gtk";

export const MainMenu = () => (
    <GtkMenuButton
        primary
        iconName="open-menu-symbolic"
        tooltipText="Main Menu"
        menuModel={
            <Menu
                items={[
                    {
                        section: [
                            { label: "New Task", action: "win.new" },
                            { label: "Select Tasks", action: "win.select" },
                        ],
                    },
                    {
                        section: [
                            { label: "Preferences", action: "win.preferences" },
                            { label: "Keyboard Shortcuts", action: "win.shortcuts" },
                        ],
                    },
                    { section: [{ label: "About Tasks", action: "win.about" }] },
                ]}
            />
        }
    />
);
```

Each entry pairs a `label` with an `action` string, and those strings are exactly the scoped action names declared earlier. There is no `onClick` here: choosing "Preferences" activates `win.preferences`, which reaches the same `setShowPreferences(true)` as the accelerator does. The `section` wrapping groups items into visually separated blocks (GTK draws a divider between sections), which is how the standard GNOME primary menu is organized.

Two `GtkMenuButton` props matter for a primary menu: `iconName="open-menu-symbolic"` is the conventional hamburger icon, and `primary` marks this as *the* window menu, which lets `F10` open it. `MainMenu` is dropped into the header bar's `end` slot:

```tsx
const listHeader = (
    <AdwHeaderBar
        titleWidget={<FilterToggle filter={filter} onChange={setFilter} />}
        start={/* ... */}
        end={<MainMenu />}
    />
);
```

## View shortcuts: `GtkShortcutController` for ephemeral keys

`Ctrl+F`, `Escape`, and `Delete` are different in kind from `win.new`. They are not commands you would ever surface in a menu, and their meaning depends on transient view state: `Escape` closes the open task, `Delete` deletes it, and both should do nothing when nothing is open. Modeling those as GActions would be awkward. Instead Tasks attaches a `GtkShortcutController`, a `GtkEventController` that holds a list of `GtkShortcut`s, each pairing a *trigger* (a key combination) with an *action* (a callback).

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { GtkShortcut, GtkShortcutController } from "@gtkx/jsx/gtk";

const makeShortcut = (accelerator: string, run: () => void, enabled: boolean) => (
    <GtkShortcut
        trigger={enabled ? Gtk.ShortcutTrigger.parseString(accelerator) : Gtk.NeverTrigger.get()}
        action={Gtk.CallbackAction.new(() => {
            run();
            return true;
        })}
    />
);

const AppShortcuts = ({
    onSearch,
    onEscape,
    escapeEnabled,
    onDelete,
    deleteEnabled,
}: {
    onSearch: () => void;
    onEscape: () => void;
    escapeEnabled: boolean;
    onDelete: () => void;
    deleteEnabled: boolean;
}) => (
    <GtkShortcutController
        scope={Gtk.ShortcutScope.GLOBAL}
        shortcuts={
            <>
                {makeShortcut("<Control>f", onSearch, true)}
                {makeShortcut("Escape", onEscape, escapeEnabled)}
                {makeShortcut("Delete", onDelete, deleteEnabled)}
            </>
        }
    />
);
```

A few gtkx-specific details:

- **`trigger`** and **`action`** are object-typed props: you pass live GI instances, not JSX. `Gtk.ShortcutTrigger.parseString("<Control>f")` parses an accelerator string into a trigger; `Gtk.CallbackAction.new(cb)` wraps a JS callback as the shortcut action. The callback returns `true` to signal the key was handled and stop further propagation.
- **`scope={Gtk.ShortcutScope.GLOBAL}`** means the shortcut fires no matter which descendant widget has focus inside the window, which is what you want for window-wide keys like search and delete.
- **Gating with `NeverTrigger`.** Rather than adding and removing shortcuts as state changes, `makeShortcut` keeps every shortcut permanently in the list and swaps its *trigger*: when `enabled` is false it uses `Gtk.NeverTrigger.get()`, a trigger that matches no key at all. So `Delete` is inert until a task is open, without churning the controller's shortcut list.

The controller mounts through the window's `controllers` slot (every `GtkWidget` has one for event controllers), and the `enabled` flags are driven straight from render state:

```tsx
controllers={
    <AppShortcuts
        onSearch={() => setSearchMode((mode) => !mode)}
        onEscape={() => {
            if (selecting) cancelSelection();
            else setSelectedTaskId(null);
        }}
        escapeEnabled={selectedTask !== null || selecting}
        onDelete={() => {
            if (selectedTask) handleDelete(selectedTask);
        }}
        deleteEnabled={selectedTask !== null}
    />
}
```

When `selectedTask` is `null`, `deleteEnabled` is false, so `Delete` resolves to `NeverTrigger` and passes through untouched. Open a task and the next render swaps in the real `parseString("Delete")` trigger. The behavior tracks state with no imperative connect/disconnect.

## The shortcuts window: `AdwShortcutsDialog`

The `win.shortcuts` action opens a dialog listing every shortcut. `AdwShortcutsDialog` is the standard GNOME "Keyboard Shortcuts" surface: a searchable window of grouped, titled sections. Tasks builds it the same declarative way as every other dialog, in `components/shortcuts.tsx`:

```tsx
import { Dialog } from "@gtkx/components/adw";
import { AdwShortcutsDialog, AdwShortcutsItem, AdwShortcutsSection } from "@gtkx/jsx/adw";

export const Shortcuts = ({ onClose }: { onClose: () => void }) => (
    <Dialog>
        <AdwShortcutsDialog onClosed={onClose}>
            <AdwShortcutsSection title="General">
                <AdwShortcutsItem title="New task" accelerator="<Control>n" />
                <AdwShortcutsItem title="Search tasks" accelerator="<Control>f" />
                <AdwShortcutsItem title="Preferences" accelerator="<Control>comma" />
                <AdwShortcutsItem title="Keyboard shortcuts" accelerator="<Control>question" />
            </AdwShortcutsSection>
            <AdwShortcutsSection title="Tasks">
                <AdwShortcutsItem title="Delete task" accelerator="Delete" />
                <AdwShortcutsItem title="Close task" accelerator="Escape" />
            </AdwShortcutsSection>
        </AdwShortcutsDialog>
    </Dialog>
);
```

Each `AdwShortcutsSection` is a titled group, and each `AdwShortcutsItem` renders one row: a `title` plus its formatted `accelerator` (`"<Control>n"` displays as `Ctrl+N`). Both are ordinary declarative `children` containers, so there is no imperative `.add()` wiring, and the whole tree updates like any other JSX. The accelerator strings are documentation, so keep them in sync with the real bindings: `<Control>n`, `<Control>f`, `<Control>comma`, and `<Control>question` come from `actionAccels` and the search shortcut, while `Delete` and `Escape` come from the `GtkShortcutController`.

`<Dialog>` (from `@gtkx/components/adw`) presents the dialog through a portal on mount and force-closes it on unmount, exactly like Preferences and About. The action handler just flips a state flag:

```tsx
onShortcuts={() => setShowShortcuts(true)}
```

and the window renders `{showShortcuts ? <Shortcuts onClose={() => setShowShortcuts(false)} /> : null}` alongside the other dialogs.

## Putting the pieces together

A single command like "create a new task" now has three front doors, all converging on the same `newTask` behavior:

- the **menu** item `{ label: "New Task", action: "win.new" }`,
- the **accelerator** `{ detailedActionName: "win.new", accels: ["<Control>n"] }`,
- and the header-bar **button** `<GtkButton onClicked={newTask} />`.

The first two resolve through `win.new`, whose `onActivate` is `newTask`; the button skips the action system and calls `newTask` directly.

Meanwhile `Ctrl+F` / `Escape` / `Delete` stay out of the action system entirely, living as state-gated `GtkShortcut`s because their meaning is view-local. And `app.complete-task` / `app.open-task` sit on the application so a notification button has an action alive even when no window is focused. Choosing the right home for each command, `win.*`, `app.*`, or a plain shortcut controller, is the whole discipline here.

## Next

Continue with **Selection Mode** to follow where the `win.select` action leads: a distinct mode for completing, moving, and deleting many tasks at once.
