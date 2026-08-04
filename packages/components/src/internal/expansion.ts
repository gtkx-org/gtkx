import type * as Gtk from "@gtkx/gi/gtk";
import type { RefObject } from "react";
import { useRef, useState } from "react";
import type { Collection } from "./collection.js";
import { eachRow } from "./collection.js";
import { useControlledSync } from "./controlled-sync.js";

type ExpansionOptions = {
    collection: Collection;
    expandedIds?: string[] | null | undefined;
    onExpandedChange?: ((ids: string[]) => void) | null | undefined;
};

type LastExpansion = { key: string };

type ExpansionContext = {
    collection: Collection;
    last: LastExpansion;
    expanding: RefObject<boolean>;
    onExpandedChange?: ((ids: string[]) => void) | null | undefined;
};

type ExpansionScan = {
    wanted: Set<string> | null;
    previous: Set<string>;
    ids: string[];
    hasDrifted: boolean;
};

function newLastExpansion(): LastExpansion {
    return { key: "" };
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

function isRowDrifted(scan: ExpansionScan, id: string, isExpanded: boolean): boolean {
    if (scan.wanted === null || isExpanded === scan.wanted.has(id)) {
        return false;
    }

    return isExpanded || scan.previous.has(id);
}

function scanRow(scan: ExpansionScan, row: Gtk.TreeListRow, id: string | null): void {
    if (id === null) {
        return;
    }

    const isExpanded = row.getExpanded();

    if (isExpanded) {
        scan.ids.push(id);
    }

    if (scan.hasDrifted) {
        return;
    }

    scan.hasDrifted = isRowDrifted(scan, id, isExpanded);
}

function scanWhenIdle(context: ExpansionContext, expandedIds: string[] | null | undefined): ExpansionScan | null {
    const tree = context.collection.treeModel();

    if (tree === null || context.expanding.current) {
        return null;
    }

    const scan: ExpansionScan = {
        wanted: expandedIds == null ? null : new Set(expandedIds),
        previous: new Set(context.last.key === "" ? [] : context.last.key.split(" ")),
        ids: [],
        hasDrifted: false,
    };

    eachRow(tree, (row, id) => {
        scanRow(scan, row, id);
    });

    return scan;
}

function reportExpansion(context: ExpansionContext, scan: ExpansionScan): void {
    const key = scan.ids.join(" ");

    if (context.last.key === key) {
        return;
    }

    context.last.key = key;
    context.onExpandedChange?.(scan.ids);
}

function applyControlledExpansion(context: ExpansionContext, expandedIds: string[] | null | undefined): void {
    const tree = context.collection.treeModel();

    if (tree === null || expandedIds == null) {
        return;
    }

    context.expanding.current = true;

    try {
        applyExpansion(tree, expandedIds);
    } finally {
        context.expanding.current = false;
    }

    const scan = scanWhenIdle(context, expandedIds);

    if (scan !== null) {
        reportExpansion(context, scan);
    }
}

function observeExpansion(
    context: ExpansionContext,
    expandedIds: string[] | null | undefined,
    onDrift: () => void,
): void {
    const scan = scanWhenIdle(context, expandedIds);

    if (scan === null) {
        return;
    }

    reportExpansion(context, scan);

    if (scan.hasDrifted) {
        onDrift();
    }
}

function useExpansion(options: ExpansionOptions): () => void {
    const { collection, expandedIds, onExpandedChange } = options;
    const [last] = useState<LastExpansion>(newLastExpansion);
    const expanding = useRef(false);
    const context: ExpansionContext = { collection, last, expanding, onExpandedChange };

    const markDrift = useControlledSync({
        ids: expandedIds,
        structureKey: collection.structureKey,
        apply: (ids) => {
            applyControlledExpansion(context, ids);
        },
    });

    return () => {
        observeExpansion(context, expandedIds, markDrift);
    };
}

export { useExpansion, type ExpansionOptions };
