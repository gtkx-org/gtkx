import type * as Gtk from "@gtkx/gi/gtk";
import { useState } from "react";
import type { Collection } from "./collection.js";
import type { TreeExpansion } from "./tree-expansion.js";
import type { VisibleOrder, WalkOptions } from "./tree-order.js";
import { isCollectionIdle } from "./collection.js";
import { useControlledSync } from "./controlled-sync.js";
import { joinParts } from "./keys.js";
import { trackPaths } from "./slots.js";
import { adoptOrder, markExpanded, orderFor } from "./tree-expansion.js";
import { walkVisible } from "./tree-order.js";

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

function newLastExpansion(): LastExpansion {
    return { key: "" };
}

function wantedSet(expansion: TreeExpansion, expandedIds: string[]): Set<string> {
    const wanted: Set<string> = new Set();

    for (const id of expandedIds) {
        for (const path of expansion.index.expandablePathsFor(id)) {
            wanted.add(path);
        }
    }

    return wanted;
}

function hasSameExpansion(expanded: Set<string>, wanted: Set<string>): boolean {
    return expanded.size === wanted.size && wanted.isSubsetOf(expanded);
}

function toggleOptions(expansion: TreeExpansion, tree: Gtk.TreeListModel, wanted: Set<string>): WalkOptions {
    return {
        index: expansion.index,
        slots: trackPaths(wanted),
        marks: trackPaths(wanted.symmetricDifference(expansion.expanded)),
        visit: (row) => {
            if (row.isMarked) {
                tree.getRow(row.position)?.setExpanded(row.isOpen);
            }
        },
    };
}

function walkApplying(expansion: TreeExpansion, options: WalkOptions): VisibleOrder {
    expansion.isApplying = true;

    try {
        return walkVisible(options);
    } finally {
        expansion.isApplying = false;
    }
}

function applyWanted(expansion: TreeExpansion, tree: Gtk.TreeListModel, expandedIds: string[]): void {
    const wanted = wantedSet(expansion, expandedIds);

    if (hasSameExpansion(expansion.expanded, wanted)) {
        return;
    }

    adoptOrder(expansion, walkApplying(expansion, toggleOptions(expansion, tree, wanted)));
}

function reportExpansion(context: ExpansionContext): void {
    const { expandedIds, expandedPaths } = orderFor(context.collection.expansion);
    const key = joinParts(expandedPaths);

    if (context.last.key === key) {
        return;
    }

    context.last.key = key;
    context.onExpandedChange?.([...expandedIds]);
}

function applyControlledExpansion(context: ExpansionContext, expandedIds: string[] | null | undefined): void {
    const tree = context.collection.treeModel();

    if (tree === null) {
        return;
    }

    applyWanted(context.collection.expansion, tree, expandedIds ?? []);
    reportExpansion(context);
}

function isExpansionIdle(collection: Collection): boolean {
    return collection.treeModel() !== null && isCollectionIdle(collection);
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
    if (!isExpansionIdle(context.collection)) {
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
    const [last] = useState<LastExpansion>(newLastExpansion);
    const context: ExpansionContext = { collection, last, onExpandedChange };

    const markDrift = useControlledSync({
        ids: expandedIds,
        collection,
        apply: (ids) => {
            applyControlledExpansion(context, ids);
        },
    });

    return (position, removed, added) => {
        observeExpansion(context, { position, removed, added }, markDrift);
    };
}

export { useExpansion, type ItemsChangeHandler };
