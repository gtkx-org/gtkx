import type * as Gtk from "@gtkx/gi/gtk";
import type { RefObject } from "react";
import { useSignal } from "@gtkx/react";
import { useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import type { Collection } from "./collection.js";
import { eachRow } from "./collection.js";

type ExpansionOptions = {
    collection: Collection;
    expandedIds?: string[] | null | undefined;
    onExpandedChange?: ((ids: string[]) => void) | null | undefined;
};

type LastExpansion = { key: string };

function newLastExpansion(): LastExpansion {
    return { key: "" };
}

function collectExpanded(row: Gtk.TreeListRow, id: string | null, ids: string[]): void {
    if (id !== null && row.getExpanded()) {
        ids.push(id);
    }
}

function expandRow(row: Gtk.TreeListRow, id: string | null, wanted: Set<string>): void {
    const isDesired = id !== null && wanted.has(id);

    if (row.isExpandable() && row.getExpanded() !== isDesired) {
        row.setExpanded(isDesired);
    }
}

function applyExpansion(tree: Gtk.TreeListModel, expandedIds: string[]): void {
    const wanted = new Set(expandedIds);

    eachRow(tree, (row, id) => {
        expandRow(row, id, wanted);
    });
}

function reportExpansion(
    collection: Collection,
    last: LastExpansion,
    onExpandedChange: ((ids: string[]) => void) | null | undefined,
): void {
    const tree = collection.treeModel();

    if (tree === null) {
        return;
    }

    const ids: string[] = [];

    eachRow(tree, (row, id) => {
        collectExpanded(row, id, ids);
    });

    const key = ids.join(" ");

    if (last.key === key) {
        return;
    }

    last.key = key;
    onExpandedChange?.(ids);
}

function reportWhenIdle(
    collection: Collection,
    last: LastExpansion,
    expanding: RefObject<boolean>,
    onExpandedChange: ((ids: string[]) => void) | null | undefined,
): void {
    if (expanding.current) {
        return;
    }

    reportExpansion(collection, last, onExpandedChange);
}

function runControlledExpansion(
    collection: Collection,
    expandedIds: string[] | null | undefined,
    expanding: RefObject<boolean>,
    report: () => void,
): void {
    const tree = collection.treeModel();

    if (tree === null || expandedIds == null) {
        return;
    }

    expanding.current = true;

    try {
        applyExpansion(tree, expandedIds);
    } finally {
        expanding.current = false;
    }

    report();
}

function useExpansion(options: ExpansionOptions): void {
    const { collection, expandedIds, onExpandedChange } = options;
    const [last] = useState<LastExpansion>(newLastExpansion);
    const expanding = useRef(false);

    const report = useEffectEvent((): void => {
        reportWhenIdle(collection, last, expanding, onExpandedChange);
    });

    useSignal(collection.isTree ? collection.model : null, "items-changed", () => {
        reportWhenIdle(collection, last, expanding, onExpandedChange);
    });

    useLayoutEffect(() => {
        runControlledExpansion(collection, expandedIds, expanding, report);
    }, [collection, expandedIds]);
}

export { useExpansion, type ExpansionOptions };
