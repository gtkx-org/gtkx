import type * as Gtk from "@gtkx/gi/gtk";
import { useState } from "react";
import type { Collection } from "./collection.js";
import type { TreeExpansion } from "./tree-expansion.js";
import type { TreeOrder } from "./tree-order.js";
import { childLevelKey } from "./collection-index.js";
import { useControlledSync } from "./controlled-sync.js";
import { adoptOrder, markExpanded, orderFor } from "./tree-expansion.js";
import { buildTreeOrder } from "./tree-order.js";

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
        if (expansion.index.children.has(childLevelKey(id))) {
            wanted.add(id);
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
    target: TreeOrder,
): void {
    for (const [position, id] of target.ids.entries()) {
        const isWanted = wanted.has(id);

        if (expanded.has(id) !== isWanted) {
            tree.getRow(position)?.setExpanded(isWanted);
        }
    }
}

function applyWanted(expansion: TreeExpansion, tree: Gtk.TreeListModel, expandedIds: string[]): void {
    const wanted = wantedSet(expansion, expandedIds);

    if (hasSameExpansion(expansion.expanded, wanted)) {
        return;
    }

    const target = buildTreeOrder(expansion.index, wanted);
    expansion.isApplying = true;

    try {
        toggleWantedRows(tree, expansion.expanded, wanted, target);
    } finally {
        expansion.isApplying = false;
    }

    adoptOrder(expansion, target);
}

function reportExpansion(context: ExpansionContext): void {
    const { expandedIds } = orderFor(context.collection.expansion);
    const key = expandedIds.join(" ");

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

    if (expandedIds != null) {
        applyWanted(context.collection.expansion, tree, expandedIds);
    }

    reportExpansion(context);
}

function isExpansionIdle(collection: Collection): boolean {
    const { expansion } = collection;

    return collection.treeModel() !== null && !expansion.isApplying && !expansion.isSyncing;
}

function didRowDrift(expansion: TreeExpansion, change: ItemsChange): boolean {
    const id = orderFor(expansion).ids[change.position - 1];
    const isExpanded = change.removed === 0 && change.added > 0;
    const isCollapsed = change.added === 0 && change.removed > 0;

    if (id === undefined || isExpanded === isCollapsed) {
        return false;
    }

    markExpanded(expansion, id, isExpanded);

    return true;
}

function observeExpansion(
    context: ExpansionContext,
    options: ExpansionOptions,
    change: ItemsChange,
    onDrift: () => void,
): void {
    if (!isExpansionIdle(context.collection)) {
        return;
    }

    const didDrift = didRowDrift(context.collection.expansion, change);
    reportExpansion(context);

    if (didDrift && options.expandedIds != null) {
        onDrift();
    }
}

function useExpansion(options: ExpansionOptions): ItemsChangeHandler {
    const { collection, expandedIds, onExpandedChange } = options;
    const [last] = useState<LastExpansion>(newLastExpansion);
    const context: ExpansionContext = { collection, last, onExpandedChange };

    const markDrift = useControlledSync({
        ids: expandedIds,
        structureKey: collection.structureKey,
        apply: (ids) => {
            applyControlledExpansion(context, ids);
        },
    });

    return (position, removed, added) => {
        observeExpansion(context, options, { position, removed, added }, markDrift);
    };
}

export { useExpansion, type ExpansionOptions, type ItemsChangeHandler };
