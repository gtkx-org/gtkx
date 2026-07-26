import type * as Gio from "@gtkx/gi/gio";
import type * as GObject from "@gtkx/gi/gobject";
import type { ReactElement } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkMultiSelection, GtkNoSelection, GtkSingleSelection } from "@gtkx/jsx/gtk";
import { useLayoutEffect, useRef, useState } from "react";
import type { Item, Section } from "../types.js";
import {
    type CollectionMode,
    type CollectionModel,
    collectionModeOf,
    createCollectionModel,
} from "./collection-model.js";
import { type Cells, type CellSize, useCells } from "./use-cells.js";

export type CollectionOptions = {
    items?: Item[] | undefined;
    sections?: Section[] | undefined;
    mode?: CollectionMode | undefined;
    size: CellSize;
    selectedIds?: string[] | null | undefined;
    onSelectionChanged?: ((ids: string[]) => void) | null | undefined;
    selectionMode?: Gtk.SelectionMode | null | undefined;
    expandedIds?: string[] | null | undefined;
    onExpandedChange?: ((ids: string[]) => void) | null | undefined;
};

export type Collection = {
    model: CollectionModel;
    cells: Cells;
    selection: ReactElement;
};

type CollectionState = {
    options: CollectionOptions;
    model: CollectionModel;
    cells: Cells;
    selection: Gtk.SelectionModel | null;
    lastSelection: { selection: Gtk.SelectionModel | null; key: string | null };
    lastExpansion: string;
    expanding: boolean;
};

type SelectionElementProps = {
    ref: (value: Gtk.SelectionModel | null) => void;
    model: Gio.ListModel;
    onSelectionChanged: () => void;
};

const selectedIdsOf = (selection: Gtk.SelectionModel, model: CollectionModel): string[] => {
    const bitset = selection.getSelection();
    const size = Number(bitset.getSize());
    const ids: string[] = [];
    for (let index = 0; index < size; index++) {
        const id = model.idAt(bitset.getNth(index));
        if (id !== null) ids.push(id);
    }
    return ids;
};

const applySingleSelection = (selection: Gtk.SingleSelection, positions: number[]): void => {
    const [first] = positions;
    if (first === undefined) selection.unselectAll();
    else selection.selectItem(first, true);
};

const applyMultiSelection = (selection: Gtk.SelectionModel, positions: number[]): void => {
    const selected = Gtk.Bitset.newEmpty();
    for (const position of positions) selected.add(position);
    selection.setSelection(selected, Gtk.Bitset.newRange(0, selection.getNItems()));
};

const applySelection = (selection: Gtk.SelectionModel, model: CollectionModel, ids: string[]): void => {
    if (selection instanceof Gtk.NoSelection) return;
    const positions = model.positionsOf(ids);
    if (ids.length > 0 && positions.length === 0) return;
    if (selection instanceof Gtk.SingleSelection) {
        applySingleSelection(selection, positions);
        return;
    }
    applyMultiSelection(selection, positions);
};

const rowId = (model: CollectionModel, holder: GObject.Object | null): string | null =>
    holder === null ? null : (model.entryOf(holder)?.id ?? null);

const eachRow = (
    tree: Gtk.TreeListModel,
    model: CollectionModel,
    visit: (row: Gtk.TreeListRow, id: string | null) => void,
): void => {
    for (let position = 0; position < tree.getNItems(); position++) {
        const row = tree.getRow(position);
        if (row === null) continue;
        visit(row, rowId(model, row.getItem()));
    }
};

const reportSelection = (state: CollectionState): void => {
    const { selection, model } = state;
    if (selection === null) return;
    const ids = selectedIdsOf(selection, model);
    const key = ids.join(" ");
    if (state.lastSelection.selection === selection && state.lastSelection.key === key) return;
    state.lastSelection = { selection, key };
    state.options.onSelectionChanged?.(ids);
};

const reportExpansion = (state: CollectionState): void => {
    const tree = state.model.treeModel;
    if (tree === null) return;
    const ids: string[] = [];
    eachRow(tree, state.model, (row, id) => {
        if (id !== null && row.getExpanded()) ids.push(id);
    });
    const key = ids.join(" ");
    if (state.lastExpansion === key) return;
    state.lastExpansion = key;
    state.options.onExpandedChange?.(ids);
};

const selectionElement = (mode: Gtk.SelectionMode | null | undefined, props: SelectionElementProps): ReactElement => {
    if (mode === Gtk.SelectionMode.MULTIPLE) return <GtkMultiSelection {...props} />;
    if (mode === Gtk.SelectionMode.NONE) return <GtkNoSelection {...props} />;
    return <GtkSingleSelection {...props} autoselect={false} canUnselect />;
};

export const useCollectionModel = (mode: CollectionMode): CollectionModel => {
    const held = useRef<{ mode: CollectionMode; model: CollectionModel } | null>(null);
    if (held.current === null || held.current.mode !== mode) {
        held.current = { mode, model: createCollectionModel(mode) };
    }
    return held.current.model;
};

const useDataSync = (state: CollectionState): void => {
    const { model, cells } = state;
    const { items, sections } = state.options;
    useLayoutEffect(() => {
        model.update({ items, sections });
        cells.refresh();
    }, [model, cells, items, sections]);
};

const useControlledExpansion = (state: CollectionState): void => {
    const { model, cells } = state;
    const { expandedIds, items, sections } = state.options;
    useLayoutEffect(() => {
        const tree = model.treeModel;
        if (tree === null) return;
        const handler = (): void => {
            cells.refresh();
            if (!state.expanding) reportExpansion(state);
        };
        tree.on("items-changed", handler);
        return () => {
            tree.off("items-changed", handler);
        };
    }, [state, model, cells]);
    useLayoutEffect(() => {
        const tree = model.treeModel;
        if (tree === null || expandedIds == null) return;
        const wanted = new Set(expandedIds);
        state.expanding = true;
        try {
            eachRow(tree, model, (row, id) => {
                const desired = id !== null && wanted.has(id);
                if (row.isExpandable() && row.getExpanded() !== desired) row.setExpanded(desired);
            });
        } finally {
            state.expanding = false;
        }
        reportExpansion(state);
    }, [state, model, expandedIds, items, sections]);
};

const useControlledSelection = (state: CollectionState): void => {
    const { model, selection } = state;
    const { selectedIds, items, sections } = state.options;
    useLayoutEffect(() => {
        if (selection === null) return;
        if (selectedIds != null) applySelection(selection, model, selectedIds);
        reportSelection(state);
    }, [state, selection, model, selectedIds, items, sections]);
};

export const useCollection = (options: CollectionOptions): Collection => {
    const { items, sections, selectionMode } = options;
    const model = useCollectionModel(options.mode ?? collectionModeOf({ items, sections }));
    const cells = useCells({ collection: model, size: options.size });
    const [selection, setSelection] = useState<Gtk.SelectionModel | null>(null);
    const held = useRef<CollectionState | null>(null);
    held.current ??= {
        options,
        model,
        cells,
        selection,
        lastSelection: { selection: null, key: null },
        lastExpansion: "",
        expanding: false,
    };
    const state = held.current;
    state.options = options;
    state.model = model;
    state.cells = cells;
    state.selection = selection;
    useDataSync(state);
    useControlledExpansion(state);
    useControlledSelection(state);
    return {
        model,
        cells,
        selection: selectionElement(selectionMode, {
            ref: setSelection,
            model: model.model,
            onSelectionChanged: () => reportSelection(state),
        }),
    };
};
