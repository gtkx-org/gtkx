import type * as Gtk from "@gtkx/gi/gtk";
import { useState } from "react";
import type { Collection } from "./collection.js";
import type { TreeExpansion } from "./tree-expansion.js";
import type { VisibleOrder } from "./tree-order.js";
import { isCollectionIdle } from "./collection.js";
import { useControlledSync } from "./controlled-sync.js";
import { joinParts } from "./keys.js";
import { adoptOrder, markExpanded, orderFor } from "./tree-expansion.js";
import { buildVisibleOrder } from "./tree-order.js";

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

function toggleWantedRows(
    tree: Gtk.TreeListModel,
    expanded: Set<string>,
    wanted: Set<string>,
    target: VisibleOrder,
): void {
    let position = 0;

    for (const path of target.paths) {
        const isWanted = wanted.has(path);

        if (expanded.has(path) !== isWanted) {
            tree.getRow(position)?.setExpanded(isWanted);
        }

        position += 1;
    }
}

function applyWanted(expansion: TreeExpansion, tree: Gtk.TreeListModel, expandedIds: string[]): void {
    const wanted = wantedSet(expansion, expandedIds);

    if (hasSameExpansion(expansion.expanded, wanted)) {
        return;
    }

    const target = buildVisibleOrder(expansion.index, wanted);
    expansion.isApplying = true;

    try {
        toggleWantedRows(tree, expansion.expanded, wanted, target);
    } finally {
        expansion.isApplying = false;
    }

    adoptOrder(expansion, target);
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

function didRowDrift(expansion: TreeExpansion, change: ItemsChange): boolean {
    const path = orderFor(expansion).paths[change.position - 1];
    const isExpanded = change.removed === 0 && change.added > 0;
    const isCollapsed = change.added === 0 && change.removed > 0;

    if (path === undefined || isExpanded === isCollapsed) {
        return false;
    }

    markExpanded(expansion, path, isExpanded);

    return true;
}

function observeExpansion(context: ExpansionContext, change: ItemsChange, onDrift: () => void): void {
    if (!isExpansionIdle(context.collection)) {
        return;
    }

    const didDrift = didRowDrift(context.collection.expansion, change);
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
