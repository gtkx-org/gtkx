import { t } from "@gtkx/i18n";
import type { Task, TaskList } from "../types.js";
import { createTask } from "./task.js";

const isoInDays = (days: number): string => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(18, 0, 0, 0);

    return date.toISOString();
};

const startOfToday = (): string => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);

    return date.toISOString();
};

const seedLists: TaskList[] = [
    { id: "personal", name: t("Personal"), color: "#3584e4" },
    { id: "work", name: t("Work"), color: "#2ec27e" },
    { id: "shopping", name: t("Shopping"), color: "#e66100" },
];

const seedTasks: Task[] = [
    createTask({
        id: "t1",
        listId: "personal",
        title: t("Welcome to Tasks"),
        position: 0,
        notes: t(
            "This is your first task. Tick the checkbox to complete it, or open it to add notes and a due date.",
        ),
    }),
    createTask({
        id: "t2",
        listId: "personal",
        title: t("Water the plants"),
        position: 1,
        due: startOfToday(),
        important: true,
    }),
    createTask({ id: "t3", listId: "work", title: t("Prepare the weekly report"), position: 2, due: isoInDays(1) }),
    createTask({ id: "t4", listId: "work", title: t("Review pull requests"), position: 3 }),
    createTask({ id: "t5", listId: "shopping", title: t("Buy oat milk"), position: 4 }),
    createTask({
        id: "t6",
        listId: "shopping",
        title: t("Order birthday gift"),
        position: 5,
        due: isoInDays(3),
        important: true,
    }),
];

export {
    seedLists,
    seedTasks,
};
