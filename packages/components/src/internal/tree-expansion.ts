import type { CollectionIndex } from "./collection-index.js";
import type { VisibleOrder } from "./tree-order.js";
import { buildVisibleOrder } from "./tree-order.js";

type TreeExpansion = {
    index: CollectionIndex;
    expanded: Set<string>;
    order: VisibleOrder | null;
    isApplying: boolean;
    isSyncing: boolean;
};

function createTreeExpansion(index: CollectionIndex): TreeExpansion {
    return { index, expanded: new Set(), order: null, isApplying: false, isSyncing: false };
}

function orderFor(expansion: TreeExpansion): VisibleOrder {
    expansion.order ??= buildVisibleOrder(expansion.index, expansion.expanded);

    return expansion.order;
}

function adoptOrder(expansion: TreeExpansion, order: VisibleOrder): void {
    expansion.expanded = new Set(order.expandedKeys);
    expansion.order = order;
}

function hasAncestorIn(index: CollectionIndex, key: string, roots: Set<string>): boolean {
    let current: string | undefined = key;

    while (current !== undefined) {
        if (roots.has(current)) {
            return true;
        }

        current = index.parents.get(current);
    }

    return false;
}

function dropSubtrees(expansion: TreeExpansion, roots: Set<string>): void {
    const kept: Set<string> = new Set();

    for (const key of expansion.expanded) {
        if (!hasAncestorIn(expansion.index, key, roots)) {
            kept.add(key);
        }
    }

    expansion.expanded = kept;
    expansion.order = null;
}

function markExpanded(expansion: TreeExpansion, key: string, isExpanded: boolean): void {
    if (isExpanded) {
        expansion.expanded.add(key);
        expansion.order = null;

        return;
    }

    expansion.expanded.delete(key);
    dropSubtrees(expansion, new Set([key]));
}

function resetExpansion(expansion: TreeExpansion): void {
    expansion.expanded = new Set();
    expansion.order = null;
}

function adoptIndex(expansion: TreeExpansion, index: CollectionIndex, rebuilt: Set<string>): void {
    expansion.index = index;

    if (rebuilt.size === 0) {
        return;
    }

    dropSubtrees(expansion, rebuilt);
    expansion.expanded = new Set(orderFor(expansion).expandedKeys);
}

export {
    adoptIndex,
    adoptOrder,
    createTreeExpansion,
    markExpanded,
    orderFor,
    resetExpansion,
    type TreeExpansion,
};
