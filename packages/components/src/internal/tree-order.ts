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

type LevelFrame = {
    level: Level;
    cursor: number;
};

type WalkFrame = LevelFrame & {
    open: Set<number> | undefined;
    marked: Set<number> | undefined;
};

type WalkState = {
    options: WalkOptions;
    stack: WalkFrame[];
    row: VisibleRow;
    order: VisibleOrder;
};

type OpenFrame = LevelFrame & {
    owner: ListItem | null;
};

type OpenWalk = {
    index: CollectionIndex;
    ids: Set<string>;
    paths: Set<string>;
    stack: OpenFrame[];
    ancestors: Set<ListItem>;
};

const NO_ITEM: ListItem = { id: "", value: undefined };

function advanceStack<F extends LevelFrame>(
    stack: F[],
    onSlot: (frame: F, slot: number) => void,
    onLeave?: (frame: F) => void,
): void {
    const frame = stack.at(-1);

    if (frame === undefined) {
        return;
    }

    if (frame.cursor >= frame.level.items.length) {
        stack.pop();
        onLeave?.(frame);

        return;
    }

    const slot = frame.cursor;
    frame.cursor += 1;
    onSlot(frame, slot);
}

function frameFor(options: WalkOptions, level: Level): WalkFrame {
    return { level, cursor: 0, open: options.slots.get(level.path), marked: options.marks?.get(level.path) };
}

function descend(state: WalkState, level: Level, slot: number): void {
    const child = state.options.index.childLevel(level, slot);

    if (child === undefined) {
        return;
    }

    state.order.expandedPaths.push(child.path);
    state.order.expandedIds.push(state.row.item.id);
    state.stack.push(frameFor(state.options, child));
}

function visitSlot(state: WalkState, frame: WalkFrame, slot: number): void {
    const item = frame.level.items[slot];

    if (item === undefined) {
        return;
    }

    const { row } = state;
    row.item = item;
    row.isOpen = frame.open?.has(slot) ?? false;
    row.isMarked = frame.marked?.has(slot) ?? false;
    state.options.visit?.(row);
    row.position += 1;

    if (row.isOpen) {
        descend(state, frame.level, slot);
    }
}

function walkVisible(options: WalkOptions): VisibleOrder {
    const order: VisibleOrder = { expandedPaths: [], expandedIds: [] };
    const row: VisibleRow = { item: NO_ITEM, position: 0, isOpen: false, isMarked: false };
    const frames = options.index.groups.map((level) => frameFor(options, level));
    const state: WalkState = { options, stack: frames.toReversed(), row, order };

    const onSlot = (frame: WalkFrame, slot: number): void => {
        visitSlot(state, frame, slot);
    };

    while (state.stack.length > 0) {
        advanceStack(state.stack, onSlot);
    }

    return order;
}

function openSlot(walk: OpenWalk, frame: OpenFrame, slot: number): void {
    const item = frame.level.items[slot];

    if (item === undefined || !walk.ids.has(item.id) || walk.ancestors.has(item)) {
        return;
    }

    const child = walk.index.childLevel(frame.level, slot);

    if (child === undefined) {
        return;
    }

    walk.paths.add(child.path);
    walk.ancestors.add(item);
    walk.stack.push({ level: child, cursor: 0, owner: item });
}

function leaveOpenFrame(walk: OpenWalk, frame: OpenFrame): void {
    if (frame.owner !== null) {
        walk.ancestors.delete(frame.owner);
    }
}

function expandedPathsFor(index: CollectionIndex, ids: Set<string>): Set<string> {
    const paths: Set<string> = new Set();

    if (ids.size === 0 || !index.isTree) {
        return paths;
    }

    const frames = index.groups.map((level) => ({ level, cursor: 0, owner: null }));
    const walk: OpenWalk = { index, ids, paths, stack: frames.toReversed(), ancestors: new Set() };

    const onSlot = (frame: OpenFrame, slot: number): void => {
        openSlot(walk, frame, slot);
    };

    const onLeave = (frame: OpenFrame): void => {
        leaveOpenFrame(walk, frame);
    };

    while (walk.stack.length > 0) {
        advanceStack(walk.stack, onSlot, onLeave);
    }

    return paths;
}

function buildVisibleOrder(index: CollectionIndex, slots: SlotMap): VisibleOrder {
    return walkVisible({ index, slots });
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
    buildVisibleOrder,
    expandedPathsFor,
    findIds,
    findRows,
    walkVisible,
    type MatchedRows,
    type VisibleOrder,
    type WalkOptions,
};
