import type { CollectionIndex } from "./collection-index.js";
import type { SlotMap } from "./slots.js";
import type { VisibleOrder } from "./tree-order.js";
import { encodePart } from "./keys.js";
import { getSlotKey, trackPath, trackPaths } from "./slots.js";
import { buildVisibleOrder } from "./tree-order.js";

type TreeExpansion = {
    index: CollectionIndex;
    expanded: Set<string>;
    slots: SlotMap;
    order: VisibleOrder | null;
    isApplying: boolean;
    isSyncing: boolean;
};

function dropLevel(expansion: TreeExpansion, path: string, pending: string[]): void {
    expansion.expanded.delete(path);
    const level = expansion.slots.get(path);

    if (level === undefined) {
        return;
    }

    expansion.slots.delete(path);

    for (const slot of level) {
        pending.push(path + encodePart(String(slot)));
    }
}

function dropSubtree(expansion: TreeExpansion, path: string): void {
    const pending: string[] = [path];

    while (pending.length > 0) {
        const current = pending.pop();

        if (current !== undefined) {
            dropLevel(expansion, current, pending);
        }
    }
}

function createTreeExpansion(index: CollectionIndex): TreeExpansion {
    return { index, expanded: new Set(), slots: new Map(), order: null, isApplying: false, isSyncing: false };
}

function orderFor(expansion: TreeExpansion): VisibleOrder {
    expansion.order ??= buildVisibleOrder(expansion.index, expansion.slots);

    return expansion.order;
}

function adoptOrder(expansion: TreeExpansion, order: VisibleOrder): void {
    expansion.expanded = new Set(order.expandedPaths);
    expansion.slots = trackPaths(order.expandedPaths);
    expansion.order = order;
}

function prunePath(expansion: TreeExpansion, path: string): void {
    const key = getSlotKey(path);

    if (key !== null) {
        expansion.slots.get(key.levelPath)?.delete(key.slot);
    }

    dropSubtree(expansion, path);
    expansion.order = null;
}

function pruneSlots(expansion: TreeExpansion, levelPath: string, isPruned: (slot: number) => boolean): void {
    const level = expansion.slots.get(levelPath);

    if (level === undefined) {
        return;
    }

    for (const slot of level) {
        if (!isPruned(slot)) {
            continue;
        }

        level.delete(slot);
        dropSubtree(expansion, levelPath + encodePart(String(slot)));
    }

    expansion.order = null;
}

function markExpanded(expansion: TreeExpansion, path: string, isExpanded: boolean): void {
    if (isExpanded) {
        expansion.expanded.add(path);
        trackPath(expansion.slots, path);
        expansion.order = null;

        return;
    }

    prunePath(expansion, path);
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
    pruneSlots,
    type TreeExpansion,
};
