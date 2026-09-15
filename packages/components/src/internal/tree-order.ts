import type { ListItem } from "../types.js";
import type { CollectionIndex, Level } from "./collection-index.js";
import type { SlotMap } from "./slots.js";

type VisibleRow = {
    item: ListItem;
    position: number;
    isOpen: boolean;
    isMarked: boolean;
};

type VisibleOrder = {
    expandedPaths: string[];
    expandedIds: string[];
};

type MatchedRows = {
    positions: number[];
    ids: string[];
};

type RowVisitor = (row: VisibleRow) => void;

type WalkOptions = {
    index: CollectionIndex;
    slots: SlotMap;
    marks?: SlotMap | undefined;
    visit?: RowVisitor | undefined;
};

type WalkState = {
    position: number;
    order: VisibleOrder;
};

function walkLevel(options: WalkOptions, level: Level, state: WalkState): void {
    const open = options.slots.get(level.path);
    const marked = options.marks?.get(level.path);

    for (const [slot, item] of level.items.entries()) {
        const isOpen = open?.has(slot) ?? false;
        options.visit?.({ item, position: state.position, isOpen, isMarked: marked?.has(slot) ?? false });
        state.position += 1;

        if (!isOpen) {
            continue;
        }

        const child = options.index.childLevel(level, slot);

        if (child !== undefined) {
            state.order.expandedPaths.push(child.path);
            state.order.expandedIds.push(item.id);
            walkLevel(options, child, state);
        }
    }
}

function walkVisible(options: WalkOptions): VisibleOrder {
    const state: WalkState = { position: 0, order: { expandedPaths: [], expandedIds: [] } };

    for (const level of options.index.groups) {
        walkLevel(options, level, state);
    }

    return state.order;
}

function expandLevel(index: CollectionIndex, level: Level, ids: Set<string>, paths: Set<string>): void {
    for (const [slot, item] of level.items.entries()) {
        if (!ids.has(item.id)) {
            continue;
        }

        const child = index.childLevel(level, slot);

        if (child !== undefined) {
            paths.add(child.path);
            expandLevel(index, child, ids, paths);
        }
    }
}

function expandedPathsFor(index: CollectionIndex, ids: Set<string>): Set<string> {
    const paths: Set<string> = new Set();

    if (ids.size === 0 || !index.isTree) {
        return paths;
    }

    for (const level of index.groups) {
        expandLevel(index, level, ids, paths);
    }

    return paths;
}

function findRows(index: CollectionIndex, slots: SlotMap, ids: Set<string>): MatchedRows {
    const positions: number[] = [];
    const found: string[] = [];

    walkVisible({
        index,
        slots,
        visit: (row) => {
            if (!ids.has(row.item.id)) {
                return;
            }

            positions.push(row.position);
            found.push(row.item.id);
        },
    });

    return { positions, ids: found };
}

function findIds(index: CollectionIndex, slots: SlotMap, positions: Set<number>): string[] {
    const found: string[] = [];

    walkVisible({
        index,
        slots,
        visit: (row) => {
            if (!positions.has(row.position)) {
                return;
            }

            found.push(row.item.id);
        },
    });

    return found;
}

export {
    expandedPathsFor,
    findIds,
    findRows,
    walkVisible,
    type MatchedRows,
    type VisibleOrder,
    type WalkOptions,
};
