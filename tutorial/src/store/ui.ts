import type { StateCreator } from "zustand";
import type { DialogKind, DialogState, Filter, Task } from "../types.js";
import type { Mutators, Store } from "./index.js";

type UiSlice = {
    collapsed: boolean;
    filter: Filter;
    searchMode: boolean;
    searchQuery: string;
    dialog: DialogState;
    setCollapsed: (isCollapsed: boolean) => void;
    setFilter: (filter: Filter) => void;
    setSearchMode: (isSearchMode: boolean) => void;
    setSearchQuery: (searchQuery: string) => void;
    resetSearch: () => void;
    showDialog: (dialog: DialogKind) => void;
    askDeleteTask: (task: Task) => void;
};

const createUiSlice: StateCreator<Store, Mutators, [], UiSlice> = (set) => ({
    collapsed: false,
    filter: "all",
    searchMode: false,
    searchQuery: "",
    dialog: { kind: "none" },
    setCollapsed: (isCollapsed) => set({ collapsed: isCollapsed }),
    setFilter: (filter) => set({ filter }),
    setSearchMode: (isSearchMode) => set({ searchMode: isSearchMode }),
    setSearchQuery: (searchQuery) => set({ searchQuery }),
    resetSearch: () => set({ searchMode: false, searchQuery: "" }),
    showDialog: (kind) => set({ dialog: { kind } }),
    askDeleteTask: (task) => set({ dialog: { kind: "delete-task", task } }),
});

export {
    createUiSlice,
    type UiSlice,
};
