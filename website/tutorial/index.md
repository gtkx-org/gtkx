---
description: "Tour a complete GNOME Tasks app built with GTKX, where real GTK4 and libadwaita widgets are rendered from the React components you already know."
---

# Build a Tasks App with GTKX

This guide walks through a complete, real GNOME application built with GTKX: **Tasks**, a task manager (app id `com.gtkx.tutorial`). It looks and behaves like a native GNOME app because it *is* one. Every list, row, header bar, and dialog you see is a real GTK4 or libadwaita widget, driven from React components you already know how to write.

<picture>
  <source srcset="/tasks-screenshot.webp" type="image/webp" />
  <img src="/tasks-screenshot.png" width="900" height="600" loading="lazy" alt="The Tasks app: an adaptive libadwaita window with a sidebar of smart views and colored user lists on the left, and a boxed task list on the right." />
</picture>

The app is already written. Rather than building it file by file, this guide tours the finished source and explains how each piece works, with snippets copied straight from `examples/tutorial/src`. You will recognize the shape immediately: `useState`, `useEffect`, `useRef`, props, keyed lists, controlled inputs. What is new is the *target*: instead of DOM nodes, your JSX renders `AdwApplicationWindow`, `AdwNavigationSplitView`, `GtkListBox`, and friends.

## What we are building

Tasks is a full-featured desktop app, not a toy. It has an adaptive `AdwNavigationSplitView`: a sidebar of smart views (All Tasks, Today, Important, Trash) plus user-created lists, next to a content pane that shows a boxed task list and swaps to a task editor when you open a task. On a narrow window the two panes collapse into a single push/pop column, automatically.

Here is the whole app root. This is the real `App` component from `app.tsx`, and it is about as much boilerplate as GTKX asks for:

```tsx
export function App() {
    const notify = useRef<NotifyHandlers>({ complete: () => {}, open: () => {} });
    return (
        <AdwApplication
            actionAccels={[
                { detailedActionName: "win.new", accels: ["<Control>n"] },
                { detailedActionName: "win.preferences", accels: ["<Control>comma"] },
                { detailedActionName: "win.shortcuts", accels: ["<Control>question"] },
            ]}
        >
            {/* app-scoped actions for notification buttons */}
            <TasksWindow notify={notify} />
        </AdwApplication>
    );
}
```

`<AdwApplication>` is the GTK application object (it calls `adw_init` and owns the libadwaita style manager). Its `actionAccels` prop wires keyboard accelerators to named actions. Inside it, `<TasksWindow>` renders an `<AdwApplicationWindow>` whose body is the split view, wrapped in an `<AdwToastOverlay>` so undo toasts can appear over everything:

```tsx
<AdwApplicationWindow ref={windowRef} title="Tasks" /* ... */>
    <AdwToastOverlay ref={toastOverlayRef}>
        <AdwNavigationSplitView
            collapsed={collapsed}
            showContent={showContent}
            sidebar={<AdwNavigationPage title="Tasks">{/* Sidebar */}</AdwNavigationPage>}
            content={
                <AdwNavigationPage title={titleFor(selection, lists)}>
                    {/* task list, editor, or selection view */}
                </AdwNavigationPage>
            }
        />
    </AdwToastOverlay>
    {/* Preferences, About, NewListDialog, DeleteConfirmation dialogs */}
</AdwApplicationWindow>
```

That is the entire skeleton. The window mounts from a three-line entry point (`index.tsx`):

```tsx
import { createRoot } from "@gtkx/react";
import { App } from "./app.js";

createRoot().render(<App />);
```

## A tour of the features

Each feature in Tasks is here because it shows off a distinct GTKX or GTK4 capability. As you read the rest of the guide, this is the map:

| Feature | What you see in the app | GTKX / GTK4 capability it teaches |
|---|---|---|
| **Local persistence** | Tasks and lists survive a restart | A `useTasks()` hook over a JSON store (`GLib` file APIs writing to the XDG data dir); lightweight UI state via `useSetting` + `GSettings` |
| **Adaptive layout** | Sidebar and content sit side by side, then collapse to one column when the window narrows | `AdwNavigationSplitView` with a controlled `collapsed` prop, driven by an `AdwBreakpoint`'s `apply`/`unapply` signals |
| **Boxed lists** | Tasks in a rounded, card-style list | `GtkListBox` / `AdwActionRow` in the `boxed-list` style |
| **Drag to reorder** | Drag a task row to a new position | `GtkDragSource` + `GtkDropTarget` mounted on a widget's `controllers` slot, closing the loop in React state |
| **Filter and search** | An All / Open / Done segmented toggle, plus `Ctrl+F` text search | `AdwToggleGroup` + `AdwToggle`; `GtkSearchBar` + `GtkSearchEntry` |
| **Selection mode** | Batch Complete / Move / Delete with a revealed bottom bar | A `selecting` state, a dedicated `SelectionView`, and a `GtkActionBar` in the toolbar's `bottomBar` slot |
| **Task editor** | A form for title, notes, due date, and an importance toggle | `AdwClamp`, preference-style rows, a `GtkCalendar`, and a `GtkTextView`, in a `TaskDetail` component |
| **Preferences** | Appearance, default sort, reminder timing | An `AdwPreferencesDialog` rendered through a portal, with two-way `useSetting` bindings |
| **Theming** | Follow the system theme, or force light / dark | `applyColorScheme` feeding `Adw.StyleManager` |
| **Undo toasts** | "Moved to Trash" with an Undo button | `Adw.Toast` added imperatively to an `AdwToastOverlay` |
| **Desktop reminders** | A system notification when a task is due | A `useReminders` hook calling `app.sendNotification` (`Gio.Notification`), with app-scoped `GSimpleAction`s handling the notification buttons |
| **Keyboard shortcuts** | `Ctrl+N`, `Ctrl+F`, `Escape`, `Delete` | `GtkShortcutController` + `GtkShortcut`, `actionAccels`, and `GSimpleAction` |

Every one of these is real, working code in `examples/tutorial/src`. Nothing is stubbed.

## What GTKX is

GTKX is a React renderer that targets native GTK4 and libadwaita instead of the DOM. You write declarative JSX; a Rust GObject runtime instantiates and updates real GTK widgets underneath. There is no webview, no Electron, no HTML or CSS-in-a-browser. Every component you import from `@gtkx/jsx/adw`, `@gtkx/jsx/gtk`, and `@gtkx/jsx/gio` maps one-to-one onto a GObject class (`AdwHeaderBar` is `Adw.HeaderBar`, `GtkButton` is `Gtk.Button`), so anything you can find in the GTK4 or libadwaita documentation is reachable from React. Because it runs on a Node runtime, you also keep the full JavaScript ecosystem: `crypto.randomUUID` for ids, `TextEncoder` / `TextDecoder` for the JSON store, and any npm package that does not need the DOM.

::: info React knowledge transfers directly
State, effects, refs, context, keys, and controlled components all work exactly as they do on the web. The parts to learn are on the GTK side: which widget does what, how libadwaita's adaptive containers behave, and the handful of GTKX conventions for slots, refs, and signals. This guide leads with those.
:::

## Prerequisites

- **Linux** with **GTK 4** and **libadwaita** installed (both ship with any current GNOME desktop; on other environments install your distribution's `gtk4` and `libadwaita` runtime packages).
- **Node.js 24 or newer.**
- Working familiarity with **React** and **TypeScript**. You do not need any prior GTK, GObject, or C experience.

## How this guide is organized

The guide moves from the outside of the app inward, then out to shipping:

- **The shell**: the application object, the window, and the adaptive `AdwNavigationSplitView` that frames everything.
- **Data and state**: the task model, the JSON store behind `useTasks`, and how `useSetting` bridges React state to `GSettings`.
- **The task list**: boxed lists, rows, inline add, filtering, search, and drag-to-reorder.
- **The editor and dialogs**: the detail form, preferences, and the undo/confirm patterns.
- **Selection, shortcuts, and notifications**: batch actions, keyboard accelerators, and desktop reminders.
- **Theming and packaging**: styling with `@gtkx/css`, and building a shippable app.

You can read it straight through or jump to whichever feature you need. Every page quotes the actual source, so you can always open the matching file under `examples/tutorial/src` and follow along.

## Next

Continue to [Getting Started](/guide/getting-started) to scaffold the project and get the edit, save, watch-it-update loop running. From there, [The Application Shell](./app-shell) breaks down how the application, window, and adaptive split view fit together.
