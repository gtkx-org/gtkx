import { useState } from "react";
import type { Collection } from "./collection.js";
import type { TreeExpansion } from "./tree-expansion.js";
import type { VisibleOrder, WalkOptions } from "./tree-order.js";
import { isCollectionIdle } from "./collection.js";
import { hasSameIds, useControlledSync } from "./controlled-sync.js";
import { joinParts } from "./keys.js";
import { trackPaths } from "./slots.js";
import { adoptOrder, markExpanded, orderFor } from "./tree-expansion.js";
import { expandedPathsFor, walkVisible } from "./tree-order.js";

type ExpansionOptions = {
    collection: Collection;
    expandedIds?: string[] | null | undefined;
    onExpandedChange?: ((ids: string[]) => void) | null | undefined;
};

type ItemsChange = {
    position: number;
    removed: number;
    added: number;
};

type ItemsChangeHandler = (position: number, removed: number, added: number) => void;
type LastExpansion = { key: string };

type ExpansionContext = {
    collection: Collection;
    last: LastExpansion;
    onExpandedChange?: ((ids: string[]) => void) | null | undefined;
};

function hasSameExpansion(expanded: Set<string>, wanted: Set<string>): boolean {
    return expanded.size === wanted.size && wanted.isSubsetOf(expanded);
}

function collapsingPositions(expansion: TreeExpansion, wanted: Set<string>): number[] {
    const positions: number[] = [];

    walkVisible({
        index: expansion.index,
        slots: expansion.slots,
        marks: trackPaths(expansion.expanded.difference(wanted)),
        visit: (row) => {
            if (row.isMarked) {
                positions.push(row.position);
            }
        },
    });

    return positions;
}

function expandOptions(collection: Collection, wanted: Set<string>): WalkOptions {
    const { expansion } = collection;

    return {
        index: expansion.index,
        slots: trackPaths(wanted),
        marks: trackPaths(wanted.difference(expansion.expanded)),
        visit: (row) => {
            if (row.isMarked) {
                collection.rowAt(row.position)?.setExpanded(true);
            }
        },
    };
}

function toggleRows(collection: Collection, wanted: Set<string>): VisibleOrder {
    for (const position of collapsingPositions(collection.expansion, wanted).toReversed()) {
        collection.rowAt(position)?.setExpanded(false);
    }

    return walkVisible(expandOptions(collection, wanted));
}

function applyWanted(collection: Collection, expandedIds: string[]): void {
    const { expansion } = collection;
    const wanted = expandedPathsFor(expansion.index, new Set(expandedIds));

    if (hasSameExpansion(expansion.expanded, wanted)) {
        return;
    }

    expansion.isApplying = true;

    try {
        adoptOrder(expansion, toggleRows(collection, wanted));
    } finally {
        expansion.isApplying = false;
    }
}

function rememberExpansion(context: ExpansionContext, expandedPaths: string[]): boolean {
    const key = joinParts(expandedPaths);
    const isKnown = context.last.key === key;
    context.last.key = key;

    return isKnown;
}

function reportExpansion(context: ExpansionContext): void {
    const { expandedIds, expandedPaths } = orderFor(context.collection.expansion);

    if (!rememberExpansion(context, expandedPaths)) {
        context.onExpandedChange?.([...expandedIds]);
    }
}

function applyControlledExpansion(context: ExpansionContext, expandedIds: string[] | null | undefined): void {
    if (!context.collection.isTree) {
        return;
    }

    const requested = expandedIds ?? [];
    applyWanted(context.collection, requested);
    const order = orderFor(context.collection.expansion);

    if (hasSameIds(order.expandedIds, requested)) {
        rememberExpansion(context, order.expandedPaths);
    } else {
        reportExpansion(context);
    }
}

function didRowDrift(collection: Collection, change: ItemsChange): boolean {
    const path = collection.pathAt(change.position - 1);
    const isExpanded = change.removed === 0 && change.added > 0;
    const isCollapsed = change.added === 0 && change.removed > 0;

    if (path === null || isExpanded === isCollapsed) {
        return false;
    }

    markExpanded(collection.expansion, path, isExpanded);

    return true;
}

function observeExpansion(context: ExpansionContext, change: ItemsChange, onDrift: () => void): void {
    if (!context.collection.isTree || !isCollectionIdle(context.collection)) {
        return;
    }

    const didDrift = didRowDrift(context.collection, change);
    reportExpansion(context);

    if (didDrift) {
        onDrift();
    }
}

function useExpansion(options: ExpansionOptions): ItemsChangeHandler {
    const { collection, expandedIds, onExpandedChange } = options;
    const [last] = useState<LastExpansion>(() => ({ key: "" }));
    const context: ExpansionContext = { collection, last, onExpandedChange };

    const markDrift = useControlledSync({
        value: expandedIds,
        source: collection,
        apply: (value) => {
            applyControlledExpansion(context, value);
        },
    });

    return (position, removed, added) => {
        observeExpansion(context, { position, removed, added }, markDrift);
    };
}

export { useExpansion, type ItemsChangeHandler };
