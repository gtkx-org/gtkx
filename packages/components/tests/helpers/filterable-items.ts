type FilterableItem = {
    id: string;
    active: boolean;
};

const FILTERABLE_ITEMS: FilterableItem[] = [
    { id: "1", active: true },
    { id: "2", active: false },
    { id: "3", active: true },
    { id: "4", active: false },
    { id: "5", active: true },
];

export type FilterMode = "all" | "active" | "inactive";

export function filterableIds(filter: FilterMode): string[] {
    return FILTERABLE_ITEMS.filter((item) => {
        if (filter === "all") return true;
        return filter === "active" ? item.active : !item.active;
    }).map((item) => item.id);
}
