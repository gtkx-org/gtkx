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
