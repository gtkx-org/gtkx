---
description: "Send one desktop reminder for each due date, with actions that survive a cold start."
---

# Reminders That Reach the Desktop

[Dragging Tasks Into Order](/v2/tutorial/drag-to-reorder) completed task-list interaction. This chapter sends a desktop notification when a task enters its reminder window and keeps notification actions working when they launch the app.

## Remember which due date was notified

The reminder marker belongs to the task because tasks already persist. Add it to `Task` in `src/types.ts`:

```diff
     createdAt: string;
     completedAt: string | null;
+    lastNotifiedDue: string | null;
```

Set it to `null` in both the seed helper in `src/store/seed.ts` and the new task created in `src/store/tasks.ts`:

```ts
lastNotifiedDue: null,
```

Add an action that records the exact due value that produced a notification:

```diff
     reorder: (draggedId: string, targetId: string) => void;
+    markNotified: (id: string, due: string) => void;
```

```ts
markNotified: (id, due) => set((state) => ({ tasks: patch(state.tasks, id, { lastNotifiedDue: due }) })),
```

A restart now preserves the marker. Changing the task's due date changes the value being compared, so the new due date can produce its own reminder.

## Sweep for due tasks

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

The first sweep runs when the hook mounts and sends upcoming tasks already inside the configured lead. `previousSweep` records the last point checked, so a delayed interval still catches a reminder threshold crossed since then, including a nonzero lead. On mount, that cursor starts one minute earlier. Completed tasks, tasks in Trash, and due values already recorded are skipped.

## Build the notification

Create `src/notifications.ts`:

```ts
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import { formatDateTime } from "./format.js";
import type { Task } from "./types.js";

export const buildReminder = (task: Task, due: string): Gio.Notification => {
    const notification = Gio.Notification.new(task.title);
    notification.setBody(`Due ${formatDateTime(due)}`);
    notification.setPriority(Gio.NotificationPriority.HIGH);
    notification.addButtonWithTarget("Mark Complete", "app.complete-task", GLib.Variant.newString(task.id));
    notification.setDefaultActionAndTarget("app.open-task", GLib.Variant.newString(task.id));
    return notification;
};
```

This is an explicit imperative boundary: `Gio.Notification` requires a title in its native constructor, and GTKX does not yet expose that constructor as a usable JSX contract. The rest of the app continues to instantiate GObjects through JSX. The [Gio notification reference](https://docs.gtk.org/gio/class.Notification.html) covers notification fields and application actions.

## Send and record together

Wire the hook into `src/components/window.tsx`:

```tsx
import { quit, useApplication, useBindSetting, useSetting } from "@gtkx/react";
import { useCallback, useEffect, useRef } from "react";
import schema from "../../data/com.gtkx.tutorial.gschema.xml";
import { useReminders } from "../hooks/use-reminders.js";
import { buildReminder } from "../notifications.js";
import type { Task } from "../types.js";

const application = useApplication();
const tasks = useStore((state) => state.tasks);
const markNotified = useStore((state) => state.markNotified);
const [reminderMinutes] = useSetting(schema, "reminder-minutes");

const sendReminder = useCallback(
    (task: Task, due: string) => {
        application.sendNotification(task.id, buildReminder(task, due));
        markNotified(task.id, due);
    },
    [application, markNotified],
);

useReminders(tasks, reminderMinutes, sendReminder);
```

The task ID is also the shell notification ID, so sending another notification for that task replaces the existing one. Recording the due value immediately after sending makes the store and desktop delivery share one path.

## Add application actions

Notification interactions target application actions because they may run before a window exists. GTKX renders them as children of `AdwApplication`; the [Gio application reference](https://docs.gtk.org/gio/class.Application.html) covers the upstream action, activation, and session-bus lifecycle. Add them to the `actions` prop in `src/app.tsx`:

```tsx
import * as GLib from "@gtkx/gi/glib";
import { GSimpleAction } from "@gtkx/jsx/gio";
import { ALL_TASKS, openTask } from "./navigation.js";
import { useStore } from "./store/index.js";

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
    <Window />
</AdwApplication>
```

These actions match the names and string targets created in `buildReminder`. They use the store and navigation ref because a notification activation does not originate inside a screen.

## Queue cold-start navigation

An `open-task` action can arrive before `NavigationContainer` mounts. Keep the latest request until the container reports that it is ready. Update `src/navigation.ts`:

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

Import `openPendingTask` in `src/components/window.tsx` and connect it to the container:

```tsx
<NavigationContainer ref={navigationRef} onReady={openPendingTask}>
    <Split.Navigator>
        …
    </Split.Navigator>
</NavigationContainer>
```

A running window opens the task immediately. A cold start stores the request, mounts the normal application tree, and opens it from `onReady`.

Desktop delivery also depends on the installed application identity and desktop entry. [Packaging the App](/v2/tutorial/packaging) adds that metadata; the development process can exercise the actions directly but does not represent an installed notification service.

## Run it

The task editor currently assigns a selected date a due time of 18:00. Choose today before 18:00, or tomorrow, then set Reminder lead time wide enough to include that time. Within a minute, the notification appears. Its body opens the task; Mark Complete updates it through the application action.

Set the lead to zero to notify on the first sweep at or just after 18:00. Restarting the app does not resend a reminder for the same due value. Change the due date and the task becomes eligible again.

For the action path during development, replace `<task-id>` with a real task ID:

```bash
gapplication action com.gtkx.tutorial complete-task "'<task-id>'"
```

The installed cold-start path becomes available after the packaging chapter installs the desktop entry.

## You built the application

Tasks now covers native Adwaita layout, GTKX JSX, navigation, forms, persistence, settings, input controllers, and desktop actions. Use the [generated element reference](/v2/guide/configuration-and-codegen#generating-element-reference-docs) for the exact widgets and libraries configured in a GTKX project. Follow the linked upstream documentation when a feature belongs to React, GTK, or GLib.

## Next

[Appendix A: Testing the App](/v2/tutorial/testing) drives the finished application through its native accessibility tree.
