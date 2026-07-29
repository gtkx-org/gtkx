import type * as Gio from "@gtkx/gi/gio";
import type { ReactElement } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkMultiSelection, GtkNoSelection, GtkSingleSelection } from "@gtkx/jsx/gtk";
import { useEffectEvent, useLayoutEffect, useState } from "react";
import type { Collection } from "./collection.js";

type SelectionOptions = {
    collection: Collection;
    selectedIds?: string[] | null | undefined;
    onSelectionChanged?: ((ids: string[]) => void) | null | undefined;
    selectionMode?: Gtk.SelectionMode | null | undefined;
};

type LastSelection = {
    selection: Gtk.SelectionModel | null;
    key: string | null;
};

type SelectionElementProps = {
    ref: (value: Gtk.SelectionModel | null) => void;
    model: Gio.ListModel;
    onSelectionChanged: () => void;
};

function getSelectedIds(selection: Gtk.SelectionModel, collection: Collection): string[] {
    const bitset = selection.getSelection();
    const size = Number(bitset.getSize());
    const ids: string[] = [];

    for (let index = 0; index < size; index++) {
        pushId(collection.idAt(bitset.getNth(index)), ids);
    }

    return ids;
}

function pushId(id: string | null, ids: string[]): void {
    if (id !== null) {
        ids.push(id);
    }
}

function applySingleSelection(selection: Gtk.SingleSelection, positions: number[]): void {
    const [first] = positions;

    if (first === undefined) {
        selection.unselectAll();

        return;
    }

    selection.selectItem(first, true);
}

function applyMultiSelection(selection: Gtk.SelectionModel, positions: number[]): void {
    const selected = Gtk.Bitset.newEmpty();

    for (const position of positions) {
        selected.add(position);
    }

    selection.setSelection(selected, Gtk.Bitset.newRange(0, selection.getNItems()));
}

function applySelection(selection: Gtk.SelectionModel, collection: Collection, ids: string[]): void {
    if (selection instanceof Gtk.NoSelection) {
        return;
    }

    const positions = collection.positionsFor(ids);

    if (ids.length > 0 && positions.length === 0) {
        return;
    }

    if (selection instanceof Gtk.SingleSelection) {
        applySingleSelection(selection, positions);

        return;
    }

    applyMultiSelection(selection, positions);
}

function reportSelection(
    selection: Gtk.SelectionModel | null,
    collection: Collection,
    last: LastSelection,
    onSelectionChanged: ((ids: string[]) => void) | null | undefined,
): void {
    if (selection === null) {
        return;
    }

    const ids = getSelectedIds(selection, collection);
    const key = ids.join(" ");

    if (last.selection === selection && last.key === key) {
        return;
    }

    last.selection = selection;
    last.key = key;
    onSelectionChanged?.(ids);
}

function selectionElement(mode: Gtk.SelectionMode | null | undefined, props: SelectionElementProps): ReactElement {
    if (mode === Gtk.SelectionMode.MULTIPLE) {
        return <GtkMultiSelection {...props} />;
    }

    if (mode === Gtk.SelectionMode.NONE) {
        return <GtkNoSelection {...props} />;
    }

    return <GtkSingleSelection {...props} autoselect={false} canUnselect />;
}

function syncSelection(
    selection: Gtk.SelectionModel | null,
    collection: Collection,
    selectedIds: string[] | null | undefined,
): void {
    if (selection === null || selectedIds == null) {
        return;
    }

    applySelection(selection, collection, selectedIds);
}

function newLastSelection(): LastSelection {
    return { selection: null, key: null };
}

function useSelection(options: SelectionOptions): ReactElement {
    const { collection, selectedIds, onSelectionChanged, selectionMode } = options;
    const [selection, setSelection] = useState<Gtk.SelectionModel | null>(null);
    const [last] = useState<LastSelection>(newLastSelection);

    const report = useEffectEvent((): void => {
        reportSelection(selection, collection, last, onSelectionChanged);
    });

    useLayoutEffect(() => {
        syncSelection(selection, collection, selectedIds);
        report();
    }, [selection, collection, selectedIds]);

    return selectionElement(selectionMode, {
        ref: setSelection,
        model: collection.model,
        onSelectionChanged: () => {
            reportSelection(selection, collection, last, onSelectionChanged);
        },
    });
}

export { useSelection, type SelectionOptions };
