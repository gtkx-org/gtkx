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
    expansion.expanded = new Set(order.expandedPaths);
    expansion.order = order;
}

function prunePath(expansion: TreeExpansion, path: string): void {
    for (const candidate of expansion.expanded) {
        if (candidate.startsWith(path)) {
            expansion.expanded.delete(candidate);
        }
    }

    expansion.order = null;
}

function markExpanded(expansion: TreeExpansion, path: string, isExpanded: boolean): void {
    if (isExpanded) {
        expansion.expanded.add(path);
        expansion.order = null;

        return;
    }

    prunePath(expansion, path);
}

function resetExpansion(expansion: TreeExpansion): void {
    expansion.expanded = new Set();
    expansion.order = null;
}

function adoptIndex(expansion: TreeExpansion, index: CollectionIndex): void {
    expansion.index = index;
    expansion.order = null;
}

export {
    adoptIndex,
    adoptOrder,
    createTreeExpansion,
    markExpanded,
    orderFor,
    prunePath,
    resetExpansion,
    type TreeExpansion,
};
