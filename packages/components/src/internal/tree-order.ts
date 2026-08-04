import type { CollectionIndex } from "./collection-index.js";
import { childLevelKey } from "./collection-index.js";

type TreeOrder = {
    ids: string[];
    expandedIds: string[];
    positions: Map<string, number>;
};

type OrderFrame = {
    ids: string[];
    cursor: number;
};

type OrderState = {
    index: CollectionIndex;
    expanded: Set<string>;
    stack: OrderFrame[];
    order: TreeOrder;
};

function pushChildLevel(state: OrderState, id: string): void {
    const level = state.index.children.get(childLevelKey(id));

    if (level === undefined || level.ids.length === 0) {
        return;
    }

    state.stack.push({ ids: level.ids, cursor: 0 });
}

function visitId(state: OrderState, id: string): void {
    const { order } = state;
    order.positions.set(id, order.ids.length);
    order.ids.push(id);

    if (!state.expanded.has(id)) {
        return;
    }

    order.expandedIds.push(id);
    pushChildLevel(state, id);
}

function advanceFrame(state: OrderState): void {
    const frame = state.stack.at(-1);
    const id = frame?.ids[frame.cursor];

    if (frame === undefined || id === undefined) {
        state.stack.pop();

        return;
    }

    frame.cursor += 1;
    visitId(state, id);
}

function buildTreeOrder(index: CollectionIndex, expanded: Set<string>): TreeOrder {
    const order: TreeOrder = { ids: [], expandedIds: [], positions: new Map() };
    const [root] = index.groups;

    if (root === undefined) {
        return order;
    }

    const state: OrderState = { index, expanded, stack: [{ ids: root.ids, cursor: 0 }], order };

    while (state.stack.length > 0) {
        advanceFrame(state);
    }

    return order;
}

export { buildTreeOrder, type TreeOrder };
