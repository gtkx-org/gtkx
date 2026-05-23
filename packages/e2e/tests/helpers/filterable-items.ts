/**
 * A simple `id`/`active` pair used by reordering and filter-view tests across
 * the e2e suite (list-view, column-view).
 */
export interface FilterableItem {
    id: string;
    active: boolean;
}

/** Five items with alternating `active` flags, used as the canonical filter input. */
export const FILTERABLE_ITEMS: readonly FilterableItem[] = [
    { id: "1", active: true },
    { id: "2", active: false },
    { id: "3", active: true },
    { id: "4", active: false },
    { id: "5", active: true },
];

/** Filter mode for {@link filterableIds}. */
export type FilterMode = "all" | "active" | "inactive";

/**
 * Returns the IDs of {@link FILTERABLE_ITEMS} that match `filter`.
 *
 * - `"all"` returns every ID,
 * - `"active"` returns only IDs whose `active` flag is `true`,
 * - `"inactive"` returns only IDs whose `active` flag is `false`.
 */
export function filterableIds(filter: FilterMode): string[] {
    return FILTERABLE_ITEMS.filter((item) => {
        if (filter === "all") return true;
        return filter === "active" ? item.active : !item.active;
    }).map((item) => item.id);
}
