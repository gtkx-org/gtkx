import type { StateCreator } from "zustand";
import type { Task } from "../types.js";
import type { Mutators, Store } from "./index.js";
import { seedTasks } from "./seed.js";

export type TasksSlice = {
    tasks: Task[];
    addTask: (listId: string, title: string) => string | null;
    setDone: (id: string, done: boolean) => void;
    setImportant: (id: string, important: boolean) => void;
    updateTask: (id: string, fields: Partial<Pick<Task, "title" | "notes" | "due" | "listId">>) => void;
    moveToTrash: (id: string) => void;
    restore: (id: string) => void;
    deleteForever: (id: string) => void;
    reorder: (draggedId: string, targetId: string) => void;
    markNotified: (id: string, due: string) => void;
};

const patch = (tasks: Task[], id: string, fields: Partial<Task>): Task[] =>
    tasks.map((task) => (task.id === id ? { ...task, ...fields } : task));

export const createTasksSlice: StateCreator<Store, Mutators, [], TasksSlice> = (set) => ({
    tasks: seedTasks,
    addTask: (listId, title) => {
        const trimmed = title.trim();
        if (trimmed === "") return null;
        const id = crypto.randomUUID();
        set((state) => ({
            tasks: [
                ...state.tasks,
                {
                    id,
                    listId,
                    title: trimmed,
                    notes: "",
                    done: false,
                    important: false,
                    deleted: false,
                    due: null,
                    position: state.tasks.length,
                    createdAt: new Date().toISOString(),
                    completedAt: null,
                    lastNotifiedDue: null,
                },
            ],
        }));
        return id;
    },
    setDone: (id, done) =>
        set((state) => ({
            tasks: patch(state.tasks, id, { done, completedAt: done ? new Date().toISOString() : null }),
        })),
    setImportant: (id, important) => set((state) => ({ tasks: patch(state.tasks, id, { important }) })),
    updateTask: (id, fields) => set((state) => ({ tasks: patch(state.tasks, id, fields) })),
    moveToTrash: (id) => set((state) => ({ tasks: patch(state.tasks, id, { deleted: true }) })),
    restore: (id) => set((state) => ({ tasks: patch(state.tasks, id, { deleted: false }) })),
    deleteForever: (id) => set((state) => ({ tasks: state.tasks.filter((task) => task.id !== id) })),
    reorder: (draggedId, targetId) =>
        set((state) => {
            const tasks = [...state.tasks];
            const from = tasks.findIndex((task) => task.id === draggedId);
            const to = tasks.findIndex((task) => task.id === targetId);
            tasks.splice(to, 0, ...tasks.splice(from, 1));
            return { tasks: tasks.map((task, index) => ({ ...task, position: index })) };
        }),
    markNotified: (id, due) => set((state) => ({ tasks: patch(state.tasks, id, { lastNotifiedDue: due }) })),
});
