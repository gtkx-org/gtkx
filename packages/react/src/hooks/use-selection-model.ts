import type * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { useLayoutEffect, useRef } from "react";
import type { ItemResolver } from "../utils/item-resolver.js";
import { useSignal } from "./use-signal.js";

/**
 * Configuration for {@link useSelectionModel}.
 *
 * @typeParam T - The value type of regular items.
 * @typeParam S - The value type of section headers.
 */
export interface SelectionModelOptions<T, S> {
    base: Gio.ListModel;
    selectionMode: Gtk.SelectionMode | null | undefined;
    selected: string[] | null | undefined;
    onSelectionChanged: ((ids: string[]) => void) | null | undefined;
    resolver: ItemResolver<T, S>;
}

type WrappingSelectionModel = (Gtk.SingleSelection | Gtk.MultiSelection | Gtk.NoSelection) & Gtk.SelectionModel;

const createSelectionModel = (mode: Gtk.SelectionMode, base: Gio.ListModel): WrappingSelectionModel => {
    if (mode === Gtk.SelectionMode.MULTIPLE) return Gtk.MultiSelection.new(base);
    if (mode === Gtk.SelectionMode.NONE) return Gtk.NoSelection.new(base);
    return Gtk.SingleSelection.new(base);
};

const bitsetOf = (positions: number[]): Gtk.Bitset => {
    const bitset = Gtk.Bitset.newEmpty();
    for (const position of positions) {
        if (position >= 0) bitset.add(position);
    }
    return bitset;
};

const applySelectedPositions = (model: Gtk.SelectionModel, positions: number[]): void => {
    if (positions.length === 0) {
        model.unselectAll();
        return;
    }
    if (model instanceof Gtk.MultiSelection) {
        const selected = bitsetOf(positions);
        const mask = Gtk.Bitset.newRange(0, Math.max(model.getNItems(), 1));
        model.setSelection(selected, mask);
        return;
    }
    const first = positions[0];
    if (first !== undefined && first >= 0) model.selectItem(first, true);
};

const readSelectedIds = <T, S>(model: Gtk.SelectionModel, resolver: ItemResolver<T, S>): string[] => {
    const selection = model.getSelection();
    const ids: string[] = [];
    const count = Number(selection.getSize());
    for (let index = 0; index < count; index++) {
        const position = selection.getNth(index);
        const id = resolver.idOf(position);
        if (id !== undefined) ids.push(id);
    }
    return ids;
};

const idsToPositions = <T, S>(ids: string[] | null | undefined, resolver: ItemResolver<T, S>): number[] => {
    if (ids === undefined || ids === null) return [];
    const positions: number[] = [];
    for (const id of ids) {
        const position = resolver.positionOf(id);
        if (position >= 0) positions.push(position);
    }
    return positions;
};

const sameIds = (a: string[], b: string[]): boolean => {
    if (a.length !== b.length) return false;
    for (let index = 0; index < a.length; index++) {
        if (a[index] !== b[index]) return false;
    }
    return true;
};

/**
 * Builds and maintains the live GTK selection model wrapping a view's position-only base model.
 *
 * The selection model class follows `selectionMode` (defaulting to single selection); a change of
 * mode produces a new wrapper over the same base model so the widget re-points to it, and the
 * controlled `selected` ids are re-applied in the same commit. When only the base model changes it
 * is set into the existing wrapper in place, so the widget's `getModel()` and the scroll state it
 * carries never transiently null and selection is never driven through a full model rebuild.
 *
 * Controlled `selected` ids are translated to positions through the resolver and applied into the
 * model, which fires `selection-changed`. That signal is mirrored back through the resolver to ids
 * and reported via `onSelectionChanged`, including on the initial render when `selected` is set.
 *
 * @typeParam T - The value type of regular items.
 * @typeParam S - The value type of section headers.
 * @param options - The base model, selection mode, controlled selection, callback, and resolver.
 * @returns The live selection model to install on the view widget.
 */
export const useSelectionModel = <T, S>(options: SelectionModelOptions<T, S>): Gtk.SelectionModel => {
    const { base, selectionMode, selected, onSelectionChanged, resolver } = options;
    const mode = selectionMode ?? Gtk.SelectionMode.SINGLE;

    const modelRef = useRef<WrappingSelectionModel | null>(null);
    const modeRef = useRef<Gtk.SelectionMode | null>(null);
    if (modelRef.current === null || modeRef.current !== mode) {
        modelRef.current = createSelectionModel(mode, base);
        modeRef.current = mode;
    } else if (modelRef.current.getModel() !== base) {
        modelRef.current.setModel(base);
    }
    const model = modelRef.current;

    const onChangedRef = useRef(onSelectionChanged);
    onChangedRef.current = onSelectionChanged;
    const resolverRef = useRef(resolver);
    resolverRef.current = resolver;
    const lastReportedRef = useRef<string[] | null>(null);

    const report = (): void => {
        const callback = onChangedRef.current;
        if (!callback) return;
        const ids = readSelectedIds(model, resolverRef.current);
        if (lastReportedRef.current !== null && sameIds(lastReportedRef.current, ids)) return;
        lastReportedRef.current = ids;
        callback(ids);
    };

    useSignal(model, "selection-changed", report);

    useLayoutEffect(() => {
        if (selected !== undefined && selected !== null) {
            applySelectedPositions(model, idsToPositions(selected, resolver));
        }
        report();
    }, [model, base, selected, resolver]);

    return model;
};
