import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Task, TaskList } from "../types.js";
import { createListsSlice, type ListsSlice } from "./lists.js";
import { fileStorage } from "./storage.js";
import { createTasksSlice, type TasksSlice } from "./tasks.js";
import { createUiSlice, type UiSlice } from "./ui.js";

export type Store = TasksSlice & ListsSlice & UiSlice;

export type PersistedState = { lists: TaskList[]; tasks: Task[] };

export type Mutators = [["zustand/persist", unknown]];

let hydrationError: unknown;

export const useStore = create<Store>()(
    persist(
        (...a) => ({
            ...createTasksSlice(...a),
            ...createListsSlice(...a),
            ...createUiSlice(...a),
        }),
        {
            name: "tasks",
            version: 1,
            storage: createJSONStorage(() => fileStorage),
            partialize: (state): PersistedState => ({ lists: state.lists, tasks: state.tasks }),
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
    throw hydrationError;
}
