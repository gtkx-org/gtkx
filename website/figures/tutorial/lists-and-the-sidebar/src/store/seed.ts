import type { Task, TaskList } from "../types.js";

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

const createdAt = new Date().toISOString();

const task = (
    fields: Partial<Task> & Pick<Task, "id" | "listId" | "title" | "position">,
): Task => ({
    notes: "",
    done: false,
    important: false,
    deleted: false,
    due: null,
    createdAt,
    completedAt: null,
    ...fields,
});

export const seedTasks: Task[] = [
    task({
        id: "t1",
        listId: "personal",
        title: "Welcome to Tasks",
        position: 0,
        notes: "This is your first task. Tick the checkbox to complete it, or open it to add notes and a due date.",
    }),
    task({
        id: "t2",
        listId: "personal",
        title: "Water the plants",
        position: 1,
        due: startOfToday(),
        important: true,
    }),
    task({
        id: "t3",
        listId: "work",
        title: "Prepare the weekly report",
        position: 2,
        due: isoInDays(1),
    }),
];

export const seedLists: TaskList[] = [
    { id: "personal", name: "Personal", color: "#3584e4" },
    { id: "work", name: "Work", color: "#2ec27e" },
    { id: "shopping", name: "Shopping", color: "#e66100" },
];
