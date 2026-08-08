import type { ListItem } from "../types.js";
import type { CollectionIndex, Level } from "./collection-index.js";
import type { SlotMap } from "./slots.js";
import { encodePart } from "./keys.js";

type VisibleRow = {
    level: Level;
    slot: number;
    item: ListItem;
    position: number;
    isOpen: boolean;
    isMarked: boolean;
};

type VisibleOrder = {
    expandedPaths: string[];
    expandedIds: string[];
};

type RowVisitor = (row: VisibleRow) => void;

type WalkOptions = {
    index: CollectionIndex;
    slots: SlotMap;
    marks?: SlotMap | undefined;
    visit?: RowVisitor | undefined;
};

type WalkFrame = {
    level: Level;
    cursor: number;
    open: Set<number> | undefined;
    marked: Set<number> | undefined;
};

type WalkState = {
    options: WalkOptions;
    stack: WalkFrame[];
    row: VisibleRow;
    order: VisibleOrder;
};

const NO_LEVEL: Level = { path: "", items: [], expandableFlags: [] };
const NO_ITEM: ListItem = { id: "", value: undefined };

const getRowPath = (row: VisibleRow): string => row.level.path + encodePart(String(row.slot));

function frameFor(options: WalkOptions, level: Level): WalkFrame {
    return { level, cursor: 0, open: options.slots.get(level.path), marked: options.marks?.get(level.path) };
}

function descend(state: WalkState, path: string): void {
    const child = state.options.index.children.get(path);

    if (child === undefined || child.items.length === 0) {
        return;
    }

    state.order.expandedPaths.push(path);
    state.order.expandedIds.push(state.row.item.id);
    state.stack.push(frameFor(state.options, child));
}

function visitSlot(state: WalkState, frame: WalkFrame, slot: number): void {
    const item = frame.level.items[slot];

    if (item === undefined) {
        return;
    }

    const { row } = state;
    row.level = frame.level;
    row.slot = slot;
    row.item = item;
    row.isOpen = frame.open?.has(slot) ?? false;
    row.isMarked = frame.marked?.has(slot) ?? false;
    state.options.visit?.(row);
    row.position += 1;

    if (row.isOpen) {
        descend(state, getRowPath(row));
    }
}

function advanceFrame(state: WalkState): void {
    const frame = state.stack.at(-1);

    if (frame === undefined || frame.cursor >= frame.level.items.length) {
        state.stack.pop();

        return;
    }

    const slot = frame.cursor;
    frame.cursor += 1;
    visitSlot(state, frame, slot);
}

function walkVisible(options: WalkOptions): VisibleOrder {
    const order: VisibleOrder = { expandedPaths: [], expandedIds: [] };
    const row: VisibleRow = { level: NO_LEVEL, slot: 0, item: NO_ITEM, position: 0, isOpen: false, isMarked: false };
    const frames = options.index.groups.map((level) => frameFor(options, level));
    const state: WalkState = { options, stack: frames.toReversed(), row, order };

    while (state.stack.length > 0) {
        advanceFrame(state);
    }

    return order;
}

function buildVisibleOrder(index: CollectionIndex, slots: SlotMap): VisibleOrder {
    return walkVisible({ index, slots });
}

function findPositions(index: CollectionIndex, slots: SlotMap, ids: Set<string>): number[] {
    const found: number[] = [];

    walkVisible({
        index,
        slots,
        visit: (row) => {
            if (ids.has(row.item.id)) {
                found.push(row.position);
            }
        },
    });

    return found;
}

export {
    buildVisibleOrder,
    findPositions,
    walkVisible,
    type VisibleOrder,
    type WalkOptions,
};
