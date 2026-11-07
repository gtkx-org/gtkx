import { create } from "zustand";
import type { Task } from "../types.js";
import { seedTasks } from "./seed.js";

export type Store = {
    tasks: Task[];
    addTask: (listId: string, title: string) => string | null;
};

export const useStore = create<Store>()((set) => ({
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
}));
