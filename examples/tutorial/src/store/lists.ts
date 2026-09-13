import type { StateCreator } from "zustand";
import type { TaskList } from "../types.js";
import type { Mutators, Store } from "./index.js";
import { seedLists } from "./seed.js";

export type ListsSlice = {
    lists: TaskList[];
    addList: (name: string, color: string) => void;
};

export const createListsSlice: StateCreator<Store, Mutators, [], ListsSlice> = (set) => ({
    lists: seedLists,
    addList: (name, color) =>
        set((state) => ({ lists: [...state.lists, { id: crypto.randomUUID(), name, color }] })),
});
