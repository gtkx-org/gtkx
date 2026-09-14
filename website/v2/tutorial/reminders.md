---
description: "Send desktop reminders and route their actions into the app."
---

# Reminders That Reach the Desktop

The [drag chapter](/v2/tutorial/drag-to-reorder) completed task-list interaction. Add a reminder when a task reaches its configured lead time, then connect the notification's actions to the application.

## Record the notified due date

Add `lastNotifiedDue: string | null` to `Task` in `src/types.ts`. Set it to `null` in the seed helper and in the task created by `addTask`.

Add this member to `TasksSlice` in `src/store/tasks.ts`:

```ts
markNotified: (id: string, due: string) => void;
```

Add its implementation alongside the other slice actions:

```ts
markNotified: (id, due) => set((state) => ({ tasks: patch(state.tasks, id, { lastNotifiedDue: due }) })),
```

Tasks already persist, so this marker survives a restart. Comparing the exact due value lets a changed due date produce another reminder.

## Check the reminder window

Create `src/hooks/use-reminders.ts`:

```ts
import { useEffect } from "react";
import type { Task } from "../types.js";

const SWEEP_INTERVAL = 60_000;

export const useReminders = (
    tasks: Task[],
    reminderMinutes: number,
    sendReminder: (task: Task, due: string) => void,
): void => {
    useEffect(() => {
        let previousSweep = Date.now() - SWEEP_INTERVAL;
        const sweep = (): void => {
            const nowMs = Date.now();
            const leadMs = reminderMinutes * SWEEP_INTERVAL;
            for (const task of tasks) {
                const due = task.due;
                if (task.done || task.deleted || due === null || task.lastNotifiedDue === due) continue;
                const dueMs = new Date(due).getTime();
                const remaining = dueMs - nowMs;
                const reminderAt = dueMs - leadMs;
                const isReminderReached = reminderAt > previousSweep && reminderAt <= nowMs;
                if ((remaining > 0 && remaining <= leadMs) || isReminderReached) sendReminder(task, due);
            }
            previousSweep = nowMs;
        };
        sweep();
        const handle = setInterval(sweep, SWEEP_INTERVAL);
        return () => clearInterval(handle);
    }, [tasks, reminderMinutes, sendReminder]);
};
```

The hook checks immediately and once a minute. It skips completed, deleted, and already-notified tasks. The sweep cursor catches a reminder threshold crossed since the previous check, including a delayed interval; the first check looks back one minute.

## Send a notification

Create `src/notifications.ts`:

```ts
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import type { Task } from "./types.js";
import { formatDateTime } from "./format.js";

export const buildReminder = (task: Task, due: string): Gio.Notification => {
    const notification = Gio.Notification.new(task.title);
    notification.setBody(`Due ${formatDateTime(due)}`);
    notification.setPriority(Gio.NotificationPriority.HIGH);
    notification.addButtonWithTarget("Mark Complete", "app.complete-task", GLib.Variant.newString(task.id));
    notification.setDefaultActionAndTarget("app.open-task", GLib.Variant.newString(task.id));
    return notification;
};
```

The generated `Gio.Notification` binding exposes the native constructor and methods used here. Its actions target the application so they can also work after a launch. See the [Gio notification documentation](https://docs.gtk.org/gio/class.Notification.html) for the desktop's delivery and activation requirements.

In `src/components/window.tsx`, add `useApplication` to the `@gtkx/react` import and `useCallback` to the React import. Add these imports:

```ts
import type { Task } from "../types.js";
import { useReminders } from "../hooks/use-reminders.js";
import { buildReminder } from "../notifications.js";
```

Inside `Window`, reuse the `settings` instance and schema from the preferences chapter:

```ts
const application = useApplication();
const tasks = useStore((state) => state.tasks);
const markNotified = useStore((state) => state.markNotified);
const [reminderMinutes] = useSetting(settings, schema, "reminder-minutes");

const sendReminder = useCallback(
    (task: Task, due: string) => {
        application.sendNotification(task.id, buildReminder(task, due));
        markNotified(task.id, due);
    },
    [application, markNotified],
);

useReminders(tasks, reminderMinutes, sendReminder);
```

The task ID identifies the desktop notification, so a later reminder for that task replaces it. Record the due value after sending.

## Handle application actions

Update `src/app.tsx`, keeping its `App` export:

```tsx
import * as GLib from "@gtkx/gi/glib";
import { AdwApplication } from "@gtkx/jsx/adw";
import { GSimpleAction } from "@gtkx/jsx/gio";
import { SettingsProvider } from "./components/settings.js";
import { Window } from "./components/window.js";
import { ALL_TASKS, openTask } from "./navigation.js";
import { useStore } from "./store/index.js";

export function App() {
    return (
        <AdwApplication
            actionAccels={[
                { detailedActionName: "win.new", accels: ["<Control>n"] },
                { detailedActionName: "win.preferences", accels: ["<Control>comma"] },
                { detailedActionName: "win.shortcuts", accels: ["<Control>question"] },
            ]}
            actions={
                <>
                    <GSimpleAction
                        name="complete-task"
                        parameterType={GLib.VariantType.new("s")}
                        onActivate={(parameter) => {
                            useStore.getState().setDone((parameter as GLib.Variant).getString()[0], true);
                        }}
                    />
                    <GSimpleAction
                        name="open-task"
                        parameterType={GLib.VariantType.new("s")}
                        onActivate={(parameter) => {
                            openTask(ALL_TASKS, (parameter as GLib.Variant).getString()[0]);
                        }}
                    />
                </>
            }
        >
            <SettingsProvider>
                <Window />
            </SettingsProvider>
        </AdwApplication>
    );
}
```

The `actions` prop mounts `GSimpleAction` elements on the application. Their names and string parameters match the targets supplied by `buildReminder`.

An action may arrive before the navigation container mounts. In `src/navigation.ts`, add `pendingTask`, replace `openTask`, and add `openPendingTask`:

```ts
let pendingTask: { selection: Selection; id: string } | null = null;

export const openTask = (selection: Selection, id: string): void => {
    if (!navigationRef.isReady()) {
        pendingTask = { selection, id };
        return;
    }
    navigationRef.navigate("Tasks", selection);
    navigationRef.navigate("Task", { id });
};

export const openPendingTask = (): void => {
    if (pendingTask === null) return;
    const { selection, id } = pendingTask;
    pendingTask = null;
    openTask(selection, id);
};
```

Import `openPendingTask` in `window.tsx` and add `onReady={openPendingTask}` to the existing `NavigationContainer`. A ready container opens the task immediately; a newly mounted one consumes the queued request.

## Run it

The editor assigns a selected date a due time of 18:00. Pick a date and set the reminder lead time to include it. A zero-minute lead sends on the first sweep at or just after the due time. Restarting does not resend the same recorded due value.

While the development app is running, exercise an application action with a real task ID:

```bash
gapplication action com.gtkx.tutorial complete-task "'<task-id>'"
```

Desktop delivery and launching from a notification require the installed application identity and desktop entry. The [packaging chapter](/v2/tutorial/packaging) adds those. After installation, check that clicking a reminder opens its task and **Mark Complete** updates it.

## Next

[Testing the App](/v2/tutorial/testing) exercises the application through its native widgets.
