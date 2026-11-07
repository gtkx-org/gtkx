import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { fileStorage } from "./storage.js";
import type { Task } from "../types.js";
import { seedTasks } from "./seed.js";

export type Store = {
    tasks: Task[];
    addTask: (listId: string, title: string) => string | null;
    setDone: (id: string, done: boolean) => void;
    setImportant: (id: string, important: boolean) => void;
    moveToTrash: (id: string) => void;
};

const patch = (tasks: Task[], id: string, fields: Partial<Task>): Task[] =>
    tasks.map((task) => (task.id === id ? { ...task, ...fields } : task));

export type PersistedState = { tasks: Task[] };

let hydrationError: unknown;

export const useStore = create<Store>()(
    persist(
        (set) => ({
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
                        },
                    ],
                }));
                return id;
            },
            setDone: (id, done) =>
                set((state) => ({
                    tasks: patch(state.tasks, id, {
                        done,
                        completedAt: done ? new Date().toISOString() : null,
                    }),
                })),
            setImportant: (id, important) =>
                set((state) => ({
                    tasks: patch(state.tasks, id, { important }),
                })),
            moveToTrash: (id) =>
                set((state) => ({
                    tasks: patch(state.tasks, id, { deleted: true }),
                })),
        }),
        {
            name: "tasks",
            version: 1,
            storage: createJSONStorage(() => fileStorage),
            partialize: (state): PersistedState => ({ tasks: state.tasks }),
            migrate: () => {
                throw new Error("Unsupported task data version");
            },
            onRehydrateStorage: () => (_state, error) => {
                hydrationError = error;
            },
        },
    ),
);

if (hydrationError !== undefined) {
    throw new Error("Could not load saved tasks", { cause: hydrationError });
}
