type FilterableItem = {
    id: string;
    isActive: boolean;
};

type FilterMode = "all" | "active" | "inactive";

const FILTERABLE_ITEMS: FilterableItem[] = [
    { id: "1", isActive: true },
    { id: "2", isActive: false },
    { id: "3", isActive: true },
    { id: "4", isActive: false },
    { id: "5", isActive: true },
];

function filterableIds(filter: FilterMode): string[] {
    return FILTERABLE_ITEMS.filter((item) => {
        if (filter === "all") {
            return true;
        }

        return filter === "active" ? item.isActive : !item.isActive;
    }).map((item) => item.id);
}

export { filterableIds, type FilterMode };
