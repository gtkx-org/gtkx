import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";
import { useSignal } from "@gtkx/react";
import { useLayoutEffect, useRef } from "react";
import { type RowValue, rowIdOf } from "../utils/item-resolver.js";

type ExpansionModelOptions<T> = {
    treeModel: Gtk.TreeListModel | null;
    rowValues: WeakMap<GObject.Object, RowValue<T>>;
    expandedIds: string[] | null | undefined;
    onExpandedChange: ((ids: string[]) => void) | null | undefined;
};

const sameIds = (a: string[], b: string[]): boolean => {
    if (a.length !== b.length) return false;
    for (let index = 0; index < a.length; index++) {
        if (a[index] !== b[index]) return false;
    }
    return true;
};

const readExpandedIds = <T>(model: Gtk.TreeListModel, rowValues: WeakMap<GObject.Object, RowValue<T>>): string[] => {
    const ids: string[] = [];
    const count = model.getNItems();
    for (let position = 0; position < count; position++) {
        const row = model.getRow(position);
        if (row?.getExpanded()) {
            const id = rowIdOf(rowValues, row);
            if (id !== undefined) ids.push(id);
        }
    }
    return ids;
};

const applyExpanded = <T>(
    model: Gtk.TreeListModel,
    rowValues: WeakMap<GObject.Object, RowValue<T>>,
    ids: string[],
): void => {
    const target = new Set(ids);
    let changed = true;
    while (changed) {
        changed = false;
        const count = model.getNItems();
        for (let position = 0; position < count; position++) {
            const row = model.getRow(position);
            if (row === null || !row.isExpandable()) continue;
            const id = rowIdOf(rowValues, row);
            if (id === undefined) continue;
            const desired = target.has(id);
            if (row.getExpanded() !== desired) {
                row.setExpanded(desired);
                changed = true;
            }
        }
    }
};

export const useExpansionModel = <T>(options: ExpansionModelOptions<T>): void => {
    const { treeModel, rowValues, expandedIds, onExpandedChange } = options;
    const onChangeRef = useRef(onExpandedChange);
    onChangeRef.current = onExpandedChange;
    const rowValuesRef = useRef(rowValues);
    rowValuesRef.current = rowValues;
    const lastReportedRef = useRef<string[] | null>(null);
    const applyingRef = useRef(false);

    const report = (): void => {
        if (treeModel === null || applyingRef.current) return;
        const callback = onChangeRef.current;
        if (!callback) return;
        const ids = readExpandedIds(treeModel, rowValuesRef.current);
        if (lastReportedRef.current !== null && sameIds(lastReportedRef.current, ids)) return;
        lastReportedRef.current = ids;
        callback(ids);
    };

    useSignal(treeModel, "items-changed", report);

    useLayoutEffect(() => {
        if (treeModel === null) return;
        if (expandedIds !== undefined && expandedIds !== null) {
            applyingRef.current = true;
            applyExpanded(treeModel, rowValuesRef.current, expandedIds);
            applyingRef.current = false;
        }
        report();
    }, [treeModel, expandedIds]);
};
