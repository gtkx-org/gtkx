import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Task, TaskList } from "../types.js";
import { createListsSlice, type ListsSlice } from "./lists.js";
import { fileStorage } from "./storage.js";
import { createTasksSlice, type TasksSlice } from "./tasks.js";
import { createUiSlice, type UiSlice } from "./ui.js";

type Store = TasksSlice & ListsSlice & UiSlice;

type PersistedState = { lists: TaskList[]; tasks: Task[] };

type Mutators = [["zustand/persist", unknown]];

const throwHydrationError = (error: unknown): never => {
    throw error;
};

const createStore = () => {
    let hydrationError: unknown;
    const recordHydrationError = (_state: Store | undefined, error: unknown): void => {
        hydrationError = error;
    };
    const store = create<Store>()(
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
                onRehydrateStorage: () => recordHydrationError,
            },
        ),
    );

    return hydrationError === undefined ? store : throwHydrationError(hydrationError);
};

const useStore = createStore();

export {
    type Mutators,
    type PersistedState,
    type Store,
    useStore,
};
