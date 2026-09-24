import { useEffect, useRef, useState } from "react";
import type { Task } from "../types.js";

const SWEEP_INTERVAL = 60_000;

type Reminder = { id: string; due: string };

const isCurrentReminder = (task: Task | undefined, due: string): task is Task =>
    task?.due === due && !task.done && !task.deleted;

const isPendingReminder = (task: Task | undefined, due: string): task is Task =>
    isCurrentReminder(task, due) && task.lastNotifiedDue !== due;

type Sweep = { nowMs: number; previousMs: number; leadMs: number };

const isDue = (due: string, sweep: Sweep): boolean => {
    const dueMs = new Date(due).getTime();
    const remaining = dueMs - sweep.nowMs;
    const reminderAt = dueMs - sweep.leadMs;
    const isReminderReached = reminderAt > sweep.previousMs && reminderAt <= sweep.nowMs;

    return isReminderReached || (remaining > 0 && remaining <= sweep.leadMs);
};

const reminderFor = (task: Task, queued: Reminder[], sweep: Sweep): Reminder | undefined => {
    const due = task.due;
    if (due === null) {
        return undefined;
    }
    const isQueued = queued.some((reminder) => reminder.id === task.id && reminder.due === due);
    if (isQueued) {
        return isCurrentReminder(task, due) ? { id: task.id, due } : undefined;
    }
    if (!isPendingReminder(task, due) || !isDue(due, sweep)) {
        return undefined;
    }

    return { id: task.id, due };
};

const remindersFor = (tasks: Task[], queued: Reminder[], sweep: Sweep): Reminder[] => {
    const pending: Reminder[] = [];
    for (const task of tasks) {
        const reminder = reminderFor(task, queued, sweep);
        if (reminder !== undefined) {
            pending.push(reminder);
        }
    }

    return pending;
};

const useReminders = (tasks: Task[], reminderMinutes: number): Reminder[] => {
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const previousSweep = useRef<number | null>(null);
    useEffect(() => {
        const sweep = (): void => {
            const nowMs = Date.now();
            const previousMs = Math.min(previousSweep.current ?? nowMs, nowMs - SWEEP_INTERVAL);
            const leadMs = reminderMinutes * SWEEP_INTERVAL;
            previousSweep.current = nowMs;
            setReminders((queued) => remindersFor(tasks, queued, { nowMs, previousMs, leadMs }));
        };
        sweep();
        const handle = setInterval(sweep, SWEEP_INTERVAL);

        return () => {
            clearInterval(handle);
        };
    }, [tasks, reminderMinutes]);

    return reminders;
};

export {
    isCurrentReminder,
    isPendingReminder,
    type Reminder,
    useReminders,
};
