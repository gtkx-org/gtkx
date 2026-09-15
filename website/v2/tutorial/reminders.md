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
import { useEffect, useRef, useState } from "react";
import type { Task } from "../types.js";

const SWEEP_INTERVAL = 60_000;

export type Reminder = { id: string; due: string };

export const isPendingReminder = (task: Task | undefined, due: string): task is Task =>
    task?.due === due && !task.done && !task.deleted && task.lastNotifiedDue !== due;

export const useReminders = (tasks: Task[], reminderMinutes: number): Reminder[] => {
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const previousSweep = useRef<number | null>(null);
    useEffect(() => {
        const sweep = (): void => {
            const nowMs = Date.now();
            const previousMs = Math.min(previousSweep.current ?? nowMs, nowMs - SWEEP_INTERVAL);
            const leadMs = reminderMinutes * SWEEP_INTERVAL;
            previousSweep.current = nowMs;
            setReminders((queued) => {
                const pending: Reminder[] = [];
                for (const task of tasks) {
                    const due = task.due;
                    if (due === null || !isPendingReminder(task, due)) continue;
                    const dueMs = new Date(due).getTime();
                    const remaining = dueMs - nowMs;
                    const reminderAt = dueMs - leadMs;
                    const isReminderReached = reminderAt > previousMs && reminderAt <= nowMs;
                    const isQueued = queued.some((reminder) => reminder.id === task.id && reminder.due === due);
                    if (isQueued || (remaining > 0 && remaining <= leadMs) || isReminderReached) {
                        pending.push({ id: task.id, due });
                    }
                }
                return pending;
            });
        };
        sweep();
        const handle = setInterval(sweep, SWEEP_INTERVAL);
        return () => clearInterval(handle);
    }, [tasks, reminderMinutes]);

    return reminders;
};
```

The hook checks immediately and once a minute, returning every due task in the same sweep. It skips completed, deleted, and already-notified tasks. The cursor survives task and preference changes, catching thresholds crossed during a delayed interval. Each sweep checks at least the most recent minute; the cursor extends that window after a longer pause. Selected reminders remain queued until dispatched or made ineligible by a task edit.

## Send a notification

Create `src/notifications.tsx`:

```tsx
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import { GNotification } from "@gtkx/jsx/gio";
import { createPortal, rootElement, useApplication } from "@gtkx/react";
import { useEffect, useState } from "react";
import { isPendingReminder, type Reminder } from "./hooks/use-reminders.js";
import { formatDateTime } from "./format.js";
import { useStore } from "./store/index.js";

export const ReminderNotification = ({ id, due }: Reminder) => {
    const application = useApplication();
    const [notification, setNotification] = useState<Gio.Notification | null>(null);

    useEffect(() => {
        const store = useStore.getState();
        const task = store.tasks.find((current) => current.id === id);
        if (notification === null || !isPendingReminder(task, due)) return;

        notification.setTitle(task.title);
        notification.setBody(`Due ${formatDateTime(due)}`);
        notification.setPriority(Gio.NotificationPriority.HIGH);
        notification.addButtonWithTarget("Mark Complete", "app.complete-task", GLib.Variant.newString(task.id));
        notification.setDefaultActionAndTarget("app.open-task", GLib.Variant.newString(task.id));
        application.sendNotification(task.id, notification);
        store.markNotified(task.id, due);
    }, [application, due, id, notification]);

    return createPortal(<GNotification ref={setNotification} />, rootElement);
};
```

`GNotification` is a generated JSX element. The portal owns its lifetime; the state-backed ref makes the native object available to the effect. Notification content uses native methods, so set it after mounting and before sending. Before dispatch, read the current task again: it may have been completed, deleted, or rescheduled since the sweep. The same predicate checks eligibility in both places and prevents effect replay from resending a recorded due value.

The task ID identifies the desktop notification, allowing a later reminder to replace it. Recording the due value marks a dispatch attempt; the desktop does not acknowledge delivery through `sendNotification`. See [Gio's notification documentation](https://docs.gtk.org/gio/class.Notification.html) for desktop delivery and activation requirements.

In `src/components/window.tsx`, add these imports:

```ts
import { useReminders } from "../hooks/use-reminders.js";
import { ReminderNotification } from "../notifications.js";
```

Inside `Window`, reuse `tasks`, the settings instance, and the schema from the earlier chapters:

```ts
const [reminderMinutes] = useSetting(settings, schema, "reminder-minutes");
const reminders = useReminders(tasks, reminderMinutes);
```

Render the reminders inside the existing `ToastProvider`, before `AdwApplicationWindow`:

```tsx
{reminders.map((reminder) => (
    <ReminderNotification key={`${reminder.id}:${reminder.due}`} {...reminder} />
))}
```

Each task/due pair gets its own notification object. After dispatch updates the store, the next sweep removes that reminder and releases its portal.

## Handle application actions

Update `src/app.tsx`, keeping its `App` export:

```tsx
import type * as Adw from "@gtkx/gi/adw";
import * as GLib from "@gtkx/gi/glib";
import { AdwApplication } from "@gtkx/jsx/adw";
import { GSimpleAction } from "@gtkx/jsx/gio";
import { useState } from "react";
import { SettingsProvider } from "./components/settings.js";
import { Window } from "./components/window.js";
import { ALL_TASKS, openTask } from "./navigation.js";
import { useStore } from "./store/index.js";

export function App() {
    const [application, setApplication] = useState<Adw.Application | null>(null);

    return (
        <AdwApplication
            ref={setApplication}
            onActivate={() => application?.getActiveWindow()?.present()}
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
                            application?.activate();
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

The `actions` prop mounts `GSimpleAction` elements on the application. Their names and string parameters match the targets supplied by `ReminderNotification`.

Activating an action is separate from activating the application. `open-task` queues navigation and then calls `activate()` so a service launch mounts its window. The application's `onActivate` handler presents an existing window; a newly mounted `AdwApplicationWindow` presents itself. `complete-task` updates the persistent task data without opening a window.

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
