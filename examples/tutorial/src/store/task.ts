import type { Task } from "../types.js";

type TaskIdentity = Pick<Task, "id" | "listId" | "position" | "title">;

const createTask = (fields: TaskIdentity & Partial<Omit<Task, keyof TaskIdentity>>): Task => ({
    notes: "",
    done: false,
    important: false,
    deleted: false,
    due: null,
    createdAt: new Date().toISOString(),
    completedAt: null,
    lastNotifiedDue: null,
    ...fields,
});

export {
    createTask,
};
