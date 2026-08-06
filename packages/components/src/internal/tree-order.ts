import type { CollectionIndex, Level } from "./collection-index.js";
import { encodePart } from "./keys.js";

type VisibleOrder = {
    paths: string[];
    expandedPaths: string[];
    expandedIds: string[];
    positions: Map<string, number[]>;
};

type OrderFrame = {
    level: Level;
    cursor: number;
};

type OrderState = {
    index: CollectionIndex;
    expanded: Set<string>;
    stack: OrderFrame[];
    order: VisibleOrder;
};

function pushPosition(positions: Map<string, number[]>, id: string, position: number): void {
    const existing = positions.get(id);

    if (existing === undefined) {
        positions.set(id, [position]);

        return;
    }

    existing.push(position);
}

function childLevelFor(state: OrderState, path: string): Level | null {
    const level = state.index.children.get(path);

    return level === undefined || level.items.length === 0 ? null : level;
}

function visitSlot(state: OrderState, level: Level, slot: number): void {
    const item = level.items[slot];

    if (item === undefined) {
        return;
    }

    const path = level.path + encodePart(String(slot));
    const { order } = state;
    pushPosition(order.positions, item.id, order.paths.length);
    order.paths.push(path);

    if (!state.expanded.has(path)) {
        return;
    }

    const child = childLevelFor(state, path);

    if (child === null) {
        return;
    }

    order.expandedPaths.push(path);
    order.expandedIds.push(item.id);
    state.stack.push({ level: child, cursor: 0 });
}

function advanceFrame(state: OrderState): void {
    const frame = state.stack.at(-1);

    if (frame === undefined || frame.cursor >= frame.level.items.length) {
        state.stack.pop();

        return;
    }

    const slot = frame.cursor;
    frame.cursor += 1;
    visitSlot(state, frame.level, slot);
}

function buildVisibleOrder(index: CollectionIndex, expanded: Set<string>): VisibleOrder {
    const order: VisibleOrder = { paths: [], expandedPaths: [], expandedIds: [], positions: new Map() };
    const frames = index.groups.map((level) => ({ level, cursor: 0 }));
    const state: OrderState = { index, expanded, stack: frames.toReversed(), order };

    while (state.stack.length > 0) {
        advanceFrame(state);
    }

    return order;
}

export { buildVisibleOrder, type VisibleOrder };
