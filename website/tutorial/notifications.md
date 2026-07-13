---
description: "Desktop reminders with Gio.Notification: application-scoped actions that survive cold starts and fire even after the window is closed."
---

# Reminders and Notifications

Tasks have due dates, so the app fires a desktop notification when one is coming up. This is the one feature that has to keep working when the app is closed: the notification the user taps might be the thing that launches the process. That constraint shapes the whole design, so before any React, understand the two GTK/Gio pieces it forces:

- A **`Gio.Notification`** is a plain data object (title, body, priority, buttons). It does not run code. Every interactive part of it points at a named action string like `app.complete-task`, and the shell invokes that action on your `Gio.Application`, possibly after cold-starting it.
- Because the action can be invoked against a freshly launched process, it must be **application-scoped** (`app.` prefix), installed on the application itself, and it must survive the notification object being long gone.

Everything below builds up from those two facts.

## Building the notification

`src/notifications.ts` is the entire notification payload, one pure function that turns a `Task` into a `Gio.Notification`:

```ts
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import { formatDateTime } from "./format.js";
import type { Task } from "./types.js";

export const buildReminder = (task: Task): Gio.Notification => {
    const notification = Gio.Notification.new(task.title);
    notification.setBody(`Due ${formatDateTime(task.due)}`);
    notification.setPriority(Gio.NotificationPriority.HIGH);
    notification.addButtonWithTarget("Mark Complete", "app.complete-task", GLib.Variant.newString(task.id));
    notification.setDefaultActionAndTarget("app.open-task", GLib.Variant.newString(task.id));
    return notification;
};
```

Reading it against the Gio API:

- `Gio.Notification.new(title)` is the static constructor. GTK method names come through as camelCase, so `g_notification_set_body` is `setBody`, `set_priority` is `setPriority`, and so on.
- `Gio.NotificationPriority.HIGH` is the enum (`NORMAL`, `LOW`, `HIGH`, `URGENT`). `HIGH` asks the shell to show it more prominently, which is right for a time-sensitive reminder.
- `addButtonWithTarget(label, action, target)` adds a button that invokes `app.complete-task` with a `GLib.Variant` payload. `setDefaultActionAndTarget(action, target)` is what fires when the user clicks the notification body itself, here `app.open-task`.
- The target is always `GLib.Variant.newString(task.id)`. GTK actions carry at most one parameter, a `GLib.Variant`, so the task id is boxed into a string variant. The `*WithTarget` variants take the variant directly instead of forcing you to escape the id into a detailed action string like `app.open-task::<id>`.

`formatDateTime` (from `src/format.ts`) turns the ISO due string into a human label and returns `"Never"` for a null date, so the body is always well-formed.

## Why the actions must be app-scoped

::: info Why not `win.` actions
GTK splits actions into window-scoped (`win.`) and application-scoped (`app.`). A `win.` action needs a live window to target. A notification action does not have one: when the user taps a reminder after the app has been closed, GNOME Shell D-Bus-activates a brand new process, and there is no window (and no `Gio.Notification` object) yet. The only thing guaranteed to exist is the `Gio.Application` and the actions installed on it. That is why `buildReminder` targets `app.complete-task` and `app.open-task`, never `win.`-anything.
:::

## The reminder sweep

`GLib` will not fire a `Gio.Notification` at a due time for you; a notification is sent the moment you call `sendNotification`. So the app polls. `src/hooks/use-reminders.ts` is a hook that sweeps the task list on an interval and sends a reminder for anything crossing its lead time:

```ts
import { useEffect, useRef } from "react";
import type { Task } from "../types.js";

export const useReminders = (tasks: Task[], reminderMinutes: number, sendReminder: (task: Task) => void): void => {
    const notified = useRef(new Set<string>());

    useEffect(() => {
        const sweep = (): void => {
            const nowMs = Date.now();
            const leadMs = reminderMinutes * 60_000;
            for (const task of tasks) {
                if (task.done || task.deleted || !task.due || notified.current.has(task.id)) continue;
                const remaining = new Date(task.due).getTime() - nowMs;
                if (remaining <= leadMs && remaining > -86_400_000) {
                    sendReminder(task);
                    notified.current.add(task.id);
                }
            }
        };
        sweep();
        const handle = setInterval(sweep, 60_000);
        return () => clearInterval(handle);
    }, [tasks, reminderMinutes, sendReminder]);
};
```

The mechanics:

- **`notified` is a `useRef<Set<string>>`, not state.** It records which task ids have already fired so a task is not re-notified on every 60-second tick. It is a ref because writing to it must not trigger a re-render, and it must persist across renders without being a dependency.
- **`leadMs` comes from `reminderMinutes`**, the `reminder-minutes` GSettings preference read in the window (see below). A task fires when it is due within the lead window.
- **The window is `remaining <= leadMs && remaining > -86_400_000`.** So a reminder fires from `reminderMinutes` before the due time up to 24 hours (`86_400_000` ms) after it. Tasks overdue by more than a day are skipped, avoiding a burst of stale notifications the first time the app opens after being off for a while.
- **`sweep()` runs once immediately, then every 60 seconds** via `setInterval`. The effect returns `clearInterval(handle)` so the timer is torn down when dependencies change or the component unmounts. This is an ordinary React timer effect driven by the same single-thread runloop that drives GTK.

## Wiring the sweep to the application

Inside `TasksWindow` (`src/app.tsx`), the lead time is a setting and the send is one line bound to the application:

```tsx
const app = useApplication();
// ...
const [reminderMinutes] = useSetting(schema, "reminder-minutes");
// ...
const sendReminder = useCallback((task: Task) => app.sendNotification(task.id, buildReminder(task)), [app]);
useReminders(tasks, reminderMinutes, sendReminder);
```

`useApplication()` returns the live `Gtk.Application` from the nearest `<AdwApplication>` ancestor. `Gtk.Application` is a `Gio.Application`, so it carries `sendNotification(id, notification)`.

The first argument to `sendNotification` is a notification **id**, and it is keyed to `task.id` on purpose. When the shell receives a second notification with an id it already has for this app, it **replaces** the first rather than stacking a duplicate. So if the sweep ever re-fires for the same task (across an app restart, say, where the in-memory `notified` set is empty again), the user sees one updated reminder, not a pile. `sendReminder` is wrapped in `useCallback` keyed on `app` so its identity is stable, keeping the hook's effect from re-subscribing on every render.

## Installing the app-scoped actions

The two actions the notification targets are declared as `<GSimpleAction>` children of `<AdwApplication>` in the top-level `App` component:

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
    );
}
```

Points to notice:

- **`name="complete-task"` becomes `app.complete-task`.** Actions placed under the application element are added to its action map with the `app.` prefix, which is exactly the string `buildReminder` targets. (Window-scoped actions, by contrast, live in the window's `actions` slot and become `win.`-prefixed.)
- **`parameterType={GLib.VariantType.new("s")}` declares the action takes a single string parameter.** This must match the `GLib.Variant.newString(task.id)` target attached to the notification; a mismatch means the action refuses to activate.
- **`onActivate` receives the `GLib.Variant | null` parameter.** `parameter.getString()` returns a `[value, length]` tuple in the GI bindings, so `parameter.getString()[0]` pulls out the task id. The `if (parameter)` guard is there because an action can be activated with no parameter.

## Bridging the action to the window

The `onActivate` handlers do not touch task state directly. They call through a ref:

```tsx
type NotifyHandlers = { complete: (id: string) => void; open: (id: string) => void };

function TasksWindow({ notify }: { notify: RefObject<NotifyHandlers> }) {
    // ...
    notify.current = {
        complete: (id) => api.setDone(id, true),
        open: (id) => {
            setSelection({ kind: "smart", view: "all" });
            setSelectedTaskId(id);
            if (collapsed) setShowContent(true);
        },
    };
    // ...
}
```

The reason for the indirection: the `GSimpleAction` elements live at the **application** level, outside `TasksWindow`, so their handlers cannot close over the window's state (`api.setDone`, `setSelection`, `setSelectedTaskId`, `collapsed`). The `notify` ref is created in `App`, passed down, and reassigned on every `TasksWindow` render to point at the current handlers. So `app.complete-task` marks the task done, and `app.open-task` navigates the split view to the task and reveals the content pane on a collapsed (mobile) layout. The action stays installed once for the life of the application; the ref keeps it pointed at the window's live handlers.

This is also what makes cold-start work. If the shell launches the app to deliver `app.open-task`, the application starts up, `TasksWindow` mounts and assigns `notify.current`, and the action then resolves to a real handler that opens the right task.

## Desktop-file requirements

For GNOME to route the notification and its actions, the app ships a desktop entry named after its application id (`flatpak/com.gtkx.tutorial.desktop`). Two keys make notifications work:

```ini
[Desktop Entry]
Name=Tasks
Exec=gtkx-tutorial
Icon=com.gtkx.tutorial
Type=Application
# ...
StartupNotify=true
X-GNOME-UsesNotifications=true
DBusActivatable=true
```

- **`X-GNOME-UsesNotifications=true`** lists the app in Settings, Notifications so the user can toggle its notifications on and off.
- **`DBusActivatable=true`** lets the shell D-Bus-activate the app to deliver an action. This is the key that makes "tap a reminder while the app is closed" launch the process and fire `app.open-task`, rather than doing nothing.

::: tip Flatpak needs no extra permission
Under Flatpak, notifications are routed through the `org.freedesktop.portal.Notification` portal automatically, so the manifest needs no `--talk-name` for the notification bus. The portal handles it, and the same desktop-file keys apply.
:::

## Next

Continue to **Feedback and Dialogs** to see how the app confirms and softens destructive actions with toasts and alert dialogs.
