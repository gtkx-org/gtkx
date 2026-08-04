import type { CollectionIndex, Level, NodeRef } from "./collection-index.js";

type VisibleOrder = {
    keys: string[];
    expandedKeys: string[];
    expandedIds: string[];
    positions: Map<string, number[]>;
};

type OrderFrame = {
    nodes: NodeRef[];
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

function childLevelFor(state: OrderState, key: string): Level | null {
    const level = state.index.children.get(key);

    return level === undefined || level.nodes.length === 0 ? null : level;
}

function visitNode(state: OrderState, node: NodeRef): void {
    const { order } = state;
    pushPosition(order.positions, node.id, order.keys.length);
    order.keys.push(node.key);

    if (!state.expanded.has(node.key)) {
        return;
    }

    const level = childLevelFor(state, node.key);

    if (level === null) {
        return;
    }

    order.expandedKeys.push(node.key);
    order.expandedIds.push(node.id);
    state.stack.push({ nodes: level.nodes, cursor: 0 });
}

function advanceFrame(state: OrderState): void {
    const frame = state.stack.at(-1);
    const node = frame?.nodes[frame.cursor];

    if (frame === undefined || node === undefined) {
        state.stack.pop();

        return;
    }

    frame.cursor += 1;
    visitNode(state, node);
}

function buildVisibleOrder(index: CollectionIndex, expanded: Set<string>): VisibleOrder {
    const order: VisibleOrder = { keys: [], expandedKeys: [], expandedIds: [], positions: new Map() };
    const frames = index.groups.map((level) => ({ nodes: level.nodes, cursor: 0 }));
    const state: OrderState = { index, expanded, stack: frames.toReversed(), order };

    while (state.stack.length > 0) {
        advanceFrame(state);
    }

    return order;
}

export { buildVisibleOrder, type VisibleOrder };
