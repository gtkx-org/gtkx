import type { StateCreator } from "zustand";
import type { DialogKind, DialogState, Filter, Task } from "../types.js";
import type { Mutators, Store } from "./index.js";

export type UiSlice = {
    collapsed: boolean;
    filter: Filter;
    searchMode: boolean;
    searchQuery: string;
    dialog: DialogState;
    setCollapsed: (collapsed: boolean) => void;
    setFilter: (filter: Filter) => void;
    setSearchMode: (searchMode: boolean) => void;
    setSearchQuery: (searchQuery: string) => void;
    resetSearch: () => void;
    showDialog: (dialog: DialogKind) => void;
    askDeleteTask: (task: Task) => void;
};

export const createUiSlice: StateCreator<Store, Mutators, [], UiSlice> = (set) => ({
    collapsed: false,
    filter: "all",
    searchMode: false,
    searchQuery: "",
    dialog: { kind: "none" },
    setCollapsed: (collapsed) => set({ collapsed }),
    setFilter: (filter) => set({ filter }),
    setSearchMode: (searchMode) => set({ searchMode }),
    setSearchQuery: (searchQuery) => set({ searchQuery }),
    resetSearch: () => set({ searchMode: false, searchQuery: "" }),
    showDialog: (kind) => set({ dialog: { kind } }),
    askDeleteTask: (task) => set({ dialog: { kind: "delete-task", task } }),
});
