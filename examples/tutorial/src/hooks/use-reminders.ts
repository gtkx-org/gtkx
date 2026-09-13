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
