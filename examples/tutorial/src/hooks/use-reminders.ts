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
