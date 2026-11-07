import type { StateCreator } from "zustand";
import type { Filter } from "../types.js";
import type { Mutators, Store } from "./index.js";

export type UiSlice = {
    filter: Filter;
    searchMode: boolean;
    searchQuery: string;
    setFilter: (filter: Filter) => void;
    setSearchMode: (searchMode: boolean) => void;
    setSearchQuery: (searchQuery: string) => void;
    resetSearch: () => void;
};

export const createUiSlice: StateCreator<Store, Mutators, [], UiSlice> = (
    set,
) => ({
    filter: "all",
    searchMode: false,
    searchQuery: "",
    setFilter: (filter) => set({ filter }),
    setSearchMode: (searchMode) => set({ searchMode }),
    setSearchQuery: (searchQuery) => set({ searchQuery }),
    resetSearch: () => set({ searchMode: false, searchQuery: "" }),
});
