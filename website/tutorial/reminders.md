---
description: "Send a desktop notification before a task is due, with buttons that work when the app is closed."
---

# Reminders That Reach the Desktop

In [Dragging Tasks Into Order](/tutorial/drag-to-reorder) you set the order of tasks by dragging. A due date still cannot reach you when you are not looking at the app, so this page takes Tasks outside its own window.

There is no platform service you can hand a due time to, so the app checks for itself: once at startup, then once a minute after that.

## Building the notification

A desktop notification on GNOME is a `Gio.Notification`: a title, a body, a priority, and buttons. Each button names an action, and the shell can activate that action whether or not your app is running.

An action carries at most one parameter, so the task travels inside it. Box the task id into a string variant and use it as the target of both the button and the notification's default action, which fires when you click the notification body.

Create `src/notifications.ts`:

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

The action names carry the `app.` prefix, not the `win.` prefix you used in [Menus, Accelerators, and Shortcuts](/tutorial/actions-menus-shortcuts). That is why the buttons keep working after you quit: a window-scoped action needs a window, an application-scoped one does not.

`HIGH` priority asks the shell to show the notification as a banner rather than only adding it to the message tray.

## Sweeping for due tasks

A task qualifies for a notification when it is open (not done, not in Trash), it has a due time, it has not already been notified in this session, and its due time is ahead of now by no more than the lead you configured.

Both parts of that last condition matter. `remaining <= leadMs` gives the lead time its meaning: at the default of thirty minutes, a task due at six warns you at half past five. `remaining > 0` skips tasks that are already overdue, so opening the app after a week away does not fire off old banners.

Create `src/hooks/use-reminders.ts`:

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
                if (remaining > 0 && remaining <= leadMs) {
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

The effect sweeps immediately, then every minute, and clears its interval on cleanup. Because `tasks` and `reminderMinutes` are dependencies, editing a due date or changing the lead time in Preferences restarts the interval against the new values, so a task you just scheduled is considered on the next tick rather than after a restart.

The already-notified ids live in a ref, not in state or the store. A ref survives re-renders without causing one. The set is not persisted on purpose: it tracks what this process has already sent, and a new process should look at every task again.

## Sending it

The hook takes a `sendReminder` function instead of reaching for the application itself, which keeps it a plain function over data you can call from anywhere. The window supplies the real one.

`useApplication()` returns the running `Gtk.Application`, and `sendNotification(id, notification)` is the method on it. That id is the notification's identity to the shell: send one with an id already on screen and it replaces that notification instead of adding a second copy. Using the task id gives you that behavior.

Wire it up in `src/components/window.tsx`:

```tsx
import { quit, useApplication, useBindSetting, useSetting } from "@gtkx/react";
import { useCallback, useEffect, useRef } from "react";
import schema from "#data/com.gtkx.tutorial.gschema.xml";
import { useReminders } from "../hooks/use-reminders.js";
import { buildReminder } from "../notifications.js";
import type { Task } from "../types.js";
// ...

export const Window = () => {
    const application = useApplication();
    const tasks = useStore((state) => state.tasks);
    // ...

    const [colorScheme] = useSetting(schema, "color-scheme");
    const [reminderMinutes] = useSetting(schema, "reminder-minutes");
    // ...

    const sendReminder = useCallback(
        (task: Task) => application.sendNotification(task.id, buildReminder(task)),
        [application],
    );
    useReminders(tasks, reminderMinutes, sendReminder);
    // ...
};
```

`sendReminder` is wrapped in `useCallback` because the hook lists it as a dependency. Without that, every render would hand the effect a new function, tear down the interval, and sweep again. The spin row you built in [Preferences and the System Theme](/tutorial/preferences-and-theming) now takes effect: `reminder-minutes` flows from GSettings straight into the sweep's comparison.

## Actions the shell can reach

An action's scope prefix comes from where the element is mounted, not from its name. Mount a `GSimpleAction` in the application's `actions` slot and you get `app.` instead of the `win.` from [Menus, Accelerators, and Shortcuts](/tutorial/actions-menus-shortcuts).

A GAction declares its argument type instead of inferring one. `GLib.VariantType.new("s")` declares a string parameter, matching the string variant `notifications.ts` builds. In the handler the parameter is nullable, so guard it, and `getString()` returns a value and length pair, so take the first element.

Add the slot in `src/app.tsx`:

```tsx
import * as GLib from "@gtkx/gi/glib";
import { GSimpleAction } from "@gtkx/jsx/gio";
import { useStore } from "./store/index.js";
// ...

export function App() {
    return (
        <AdwApplication
            actionAccels={[
                // ...
            ]}
            actions={
                <>
                    <GSimpleAction
                        name="complete-task"
                        parameterType={GLib.VariantType.new("s")}
                        onActivate={(parameter) => {
                            if (parameter) useStore.getState().setDone(parameter.getString()[0], true);
                        }}
                    />
                    <GSimpleAction
                        name="open-task"
                        parameterType={GLib.VariantType.new("s")}
                        onActivate={(parameter) => {
                            if (!parameter) return;
                            const { select, openTask } = useStore.getState();
                            select({ kind: "smart", view: "all" });
                            openTask(parameter.getString()[0]);
                        }}
                    />
                </>
            }
        >
            <Window />
        </AdwApplication>
    );
}
```

`open-task` selects All Tasks first, because the task the shell names may not be in whichever view was showing when you quit. Without that, the detail pane could open on a task you cannot navigate back out of.

## Reaching the store from outside React

Those handlers take no props, sit in no component, and can run with no window present. `useStore.getState()` reads and writes the same store the interface renders from, and every component watching the fields they touch re-renders when they change.

Cold start shows why that matters. Click Mark Complete with the app closed, and the desktop starts your app over D-Bus just to deliver the action. The store module loads, the `persist` middleware you added in [Saving Tasks Between Runs](/tutorial/saving-to-disk) reads `tasks.json`, the handler flips one task to done, and the middleware writes the file back, all before any window is drawn.

## What delivery depends on

The desktop grants a notification based on the application's installed identity, not on anything in the running process. Two keys in the desktop entry decide it, and you write that file in [Appendix B](/tutorial/packaging):

- `DBusActivatable=true` lets the desktop start the application over D-Bus to deliver an action, which makes Mark Complete work when nothing is running.
- `X-GNOME-UsesNotifications=true` lists Tasks in the desktop's notification settings, where you can silence it.

Both depend on the application ID matching across the entry, `gtkx.config.ts`, and the GSettings schema. That is the identity a notification travels under.

## Run it

Save the new files. Both application actions are now mounted on the running app.

Open a task, set its due date to today, and pick a time a few minutes ahead of now, leaving the reminder lead at its default of thirty minutes. Within a minute a banner appears with the task title, a body reading `Due` followed by the formatted date and time, and a Mark Complete button. Click the banner body and the window comes forward with that task open in the editor.

You can also trigger Mark Complete directly. With the app running, activate the action the button targets:

```bash
gapplication action com.gtkx.tutorial complete-task "'<task-id>'"
```

The id is quoted twice because `gapplication` parses the parameter as GVariant text, where a bare UUID is not a valid literal. The task flips to done, and `cat ~/.local/share/com.gtkx.tutorial/tasks.json` shows `"done": true` on it.

Clicking the button while the app is closed takes a different path. The desktop starts a closed app over D-Bus only when it finds an installed desktop entry with `DBusActivatable=true` under the application ID the notification traveled with, and a dev session installs nothing. That path becomes available once you install `com.gtkx.tutorial.desktop` in [Appendix B](/tutorial/packaging).

## You built an app

Tasks is finished. The GTK4 and Adwaita documentation is your component reference, because a component is the widget: same type name, same properties in camelCase. Everything else you used, container slots as JSX props, controlled value plus change signal, a store outside the tree, persistence as configuration, and named actions, is the vocabulary you now use to write your own app.

### Challenges

Take these in order. Each is a real feature and smaller than the chapter it builds on.

1. **Show overdue work on the Today row.** `sidebarCounts` counts what is open; add a second count for tasks whose due time has passed and render it as an `error`-styled badge beside the existing one.
2. **Add a Snooze button to the reminder.** A second `addButtonWithTarget` targeting a new `app.snooze-task` action that pushes the due time out by ten minutes. Removing the id from the notified set is the part that needs thought, since that set lives in a ref inside the hook.
3. **Add multi-select mode.** A selection state in the UI slice, a header bar that swaps for a selection header while it is on, a `GtkActionBar` at the bottom with batch Complete, Move, and Delete, and store actions taking arrays of ids. Build the selection list with `ListView` from `@gtkx/components` rather than a list box: it recycles rows, so a thousand tasks cost as much as a screenful. See [Components](/guide/components).
4. **Add subtasks.** A `parentId` on `Task` turns the flat array into a tree, which touches the model, every selector, the row, and the drag reorder. Finishing it means you can change this app's shape rather than only extend it.

## Next

[Appendix A: Testing the App](/tutorial/testing) drives the finished app in headless tests that query the accessibility tree the way a user reaches it.
