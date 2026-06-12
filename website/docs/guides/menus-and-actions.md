# Menus, actions & shortcuts

GTK menus are data, not widgets: a `Gio.Menu` model describes the entries, actions provide the behavior, and widgets like `GtkMenuButton` render the model as a popover. GTKX keeps that split — you declare the model with `<GMenu>`, install behavior with `<GSimpleAction>`, and wire keyboard access with the `accels` prop or a shortcut controller.

## The menu model

`<GMenu>` (from `@gtkx/jsx/gio`) builds a `Gio.Menu` from a plain `items` array. Each entry is a `MenuEntry`: a `label` with an `action` name, a `submenu` of nested entries, or a `section` grouping entries inline — with the entry's `label` as the section heading when present. An underscore in a label marks its mnemonic.

```tsx
import { GMenu } from "@gtkx/jsx/gio";
import { GtkMenuButton } from "@gtkx/jsx/gtk";

<GtkMenuButton
    iconName="open-menu-symbolic"
    menuModel={
        <GMenu
            items={[
                { label: "New Note", action: "win.new" },
                {
                    label: "Sort",
                    section: [
                        { label: "By Title", action: "win.sort-title" },
                        { label: "By Date", action: "win.sort-date" },
                    ],
                },
                {
                    section: [
                        { label: "About Notes", action: "win.about" },
                        { label: "Quit", action: "win.quit" },
                    ],
                },
            ]}
        />
    }
/>;
```

When the `items` array changes, the component rebuilds the model wholesale — sections and submenus included — so menus rerender like any other React state.

## Actions

A menu entry's `action` is a detailed name: a scope prefix, a dot, and the action name. `<GSimpleAction>` installs the behavior; where you mount it decides the prefix.

Window actions go through the application window's `addAction` slot prop and live under `win.`:

```tsx
import { GSimpleAction } from "@gtkx/jsx/gio";

<AdwApplicationWindow
    title="Notes"
    addAction={
        <>
            <GSimpleAction name="new" onActivate={addNote} accels="<Control>n" />
            <GSimpleAction name="about" onActivate={() => setShowAbout(true)} />
        </>
    }
>
    …
</AdwApplicationWindow>;
```

Application actions render as children of the application component and live under `app.`:

```tsx
<AdwApplication applicationId={applicationId}>
    <GSimpleAction name="quit" onActivate={quit} accels="<Control>q" />
    <NotesWindow />
</AdwApplication>
```

::: tip Nesting throws on purpose
`GSimpleAction` is not a widget, so passing one as a plain child of a window throws an error naming the slot prop to use. Actions attach through `addAction`; the error is the reconciler steering you there.
:::

## Accelerators

The `accels` prop on `<GSimpleAction>` registers application-wide keyboard accelerators for the action's detailed name — and menus display them next to their entries automatically. It accepts one accelerator string or an array; the binding clears when the action unmounts.

GTK accelerator syntax wraps modifiers in angle brackets:

| String | Keys |
| --- | --- |
| `<Control>n` | Ctrl + N |
| `<Control><Shift>p` | Ctrl + Shift + P |
| `<Alt>F4` | Alt + F4 |
| `F11` | F11 |

## Menu buttons and popovers

`GtkMenuButton` is the standard way to open a menu — give it the model and an icon. For a popover you position yourself (a context menu, for example), `GtkPopoverMenu` takes the same `menuModel`:

```tsx
import { GtkPopoverMenu } from "@gtkx/jsx/gtk";

<GtkPopoverMenu menuModel={<GMenu items={[{ label: "Click Me", action: "win.click" }]} />} />;
```

## Menu bars

A traditional menu bar comes in two forms. The application-level menubar passes a `<GMenu>` to the application's `menubar` prop, where top-level entries become menus:

```tsx
<GtkApplication
    applicationId={applicationId}
    menubar={
        <GMenu
            items={[
                {
                    label: "File",
                    submenu: [
                        { label: "New", action: "win.new" },
                        { label: "Open", action: "win.open" },
                    ],
                },
                { label: "Edit", submenu: [{ label: "Cut", action: "win.cut" }] },
            ]}
        />
    }
>
    …
</GtkApplication>
```

Windows opt in with `showMenubar`. Alternatively, `GtkPopoverMenuBar` renders the same model as an in-window widget you can place anywhere a child goes.

## Action groups with custom prefixes

`<GSimpleActionGroup>` installs a named scope on any widget through its `insertActionGroup` slot prop — the way to give a subtree its own action namespace, as the gtk-demo message list does:

```tsx
import { GSimpleAction, GSimpleActionGroup } from "@gtkx/jsx/gio";

<GtkMenuButton
    iconName="content-loading-symbolic"
    menuModel={
        <GMenu
            items={[
                { label: "Email message", action: "msg.email" },
                { label: "Embed message", action: "msg.embed" },
            ]}
        />
    }
    insertActionGroup={
        <GSimpleActionGroup prefix="msg">
            <GSimpleAction name="email" onActivate={emailMessage} />
            <GSimpleAction name="embed" onActivate={embedMessage} />
        </GSimpleActionGroup>
    }
/>;
```

Actions inside the group bind their `accels` under the group's prefix.

## Shortcuts without menus

For keyboard behavior that has no menu entry — list navigation, panel toggles, Escape to dismiss — attach a `GtkShortcutController` through the window's `addController` slot. Each `GtkShortcut` pairs a trigger with a callback action; swapping the trigger for `Gtk.NeverTrigger.get()` disables a shortcut without unmounting it:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { GtkShortcut, GtkShortcutController } from "@gtkx/jsx/gtk";

const shortcut = (accelerator: string, run: () => void, enabled = true) => (
    <GtkShortcut
        trigger={enabled ? Gtk.ShortcutTrigger.parseString(accelerator) : Gtk.NeverTrigger.get()}
        action={Gtk.CallbackAction.new(() => {
            run();
            return true;
        })}
    />
);

<AdwApplicationWindow
    addController={
        <GtkShortcutController
            scope={Gtk.ShortcutScope.GLOBAL}
            addShortcut={
                <>
                    {shortcut("<Control>f", () => setSearchMode(true))}
                    {shortcut("Escape", () => setSelectedId(null), Boolean(selectedId))}
                </>
            }
        />
    }
>
    …
</AdwApplicationWindow>;
```

The tutorial's [Menus & shortcuts chapter](/docs/tutorial/4-menus-and-shortcuts) walks through building all of this into the Notes app.
