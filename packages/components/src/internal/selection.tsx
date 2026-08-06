import type * as Gio from "@gtkx/gi/gio";
import type { ReactElement } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkMultiSelection, GtkNoSelection, GtkSingleSelection } from "@gtkx/jsx/gtk";
import { useState } from "react";
import type { Collection } from "./collection.js";
import type { ItemsChangeHandler } from "./expansion.js";
import { isCollectionIdle } from "./collection.js";
import { useControlledSync } from "./controlled-sync.js";
import { joinParts } from "./keys.js";

type SelectionOptions = {
    collection: Collection;
    selectedIds?: string[] | null | undefined;
    onSelectionChanged?: ((ids: string[]) => void) | null | undefined;
    selectionMode?: Gtk.SelectionMode | null | undefined;
    onItemsChanged: ItemsChangeHandler;
};

type LastSelection = {
    selection: Gtk.SelectionModel | null;
    key: string | null;
};

type SelectionContext = {
    selection: Gtk.SelectionModel | null;
    collection: Collection;
    last: LastSelection;
    onSelectionChanged?: ((ids: string[]) => void) | null | undefined;
};

type SelectionElementProps = {
    ref: (value: Gtk.SelectionModel | null) => void;
    model: Gio.ListModel;
    onSelectionChanged: () => void;
    onItemsChanged: ItemsChangeHandler;
};

function selectedPositions(selection: Gtk.SelectionModel): number[] {
    const bitset = selection.getSelection();
    const size = Number(bitset.getSize());
    const positions: number[] = [];

    for (let index = 0; index < size; index++) {
        positions.push(bitset.getNth(index));
    }

    return positions;
}

function idsAt(collection: Collection, positions: number[]): string[] {
    const ids: string[] = [];

    for (const position of positions) {
        const id = collection.idAt(position);

        if (id !== null) {
            ids.push(id);
        }
    }

    return ids;
}

function plannedPositions(context: SelectionContext, ids: string[]): number[] | null {
    const { selection, collection } = context;

    if (selection === null || selection instanceof Gtk.NoSelection) {
        return null;
    }

    const positions = collection.positionsFor(ids);

    if (ids.length > 0 && positions.length === 0) {
        return null;
    }

    return selection instanceof Gtk.SingleSelection ? positions.slice(0, 1) : positions;
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

function applySelection(selection: Gtk.SelectionModel, positions: number[]): void {
    if (selection instanceof Gtk.SingleSelection) {
        applySingleSelection(selection, positions);

        return;
    }

    applyMultiSelection(selection, positions);
}

function reportSelection(context: SelectionContext, ids: string[]): void {
    const key = joinParts(ids);

    if (context.last.selection === context.selection && context.last.key === key) {
        return;
    }

    context.last.selection = context.selection;
    context.last.key = key;
    context.onSelectionChanged?.(ids);
}

function hasSelectionDrifted(actual: number[], planned: number[]): boolean {
    return actual.length !== planned.length || planned.some((position, index) => actual[index] !== position);
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

function applyControlledSelection(context: SelectionContext, selectedIds: string[] | null | undefined): void {
    const { selection, collection } = context;

    if (selection === null) {
        return;
    }

    const planned = plannedPositions(context, selectedIds ?? []);

    if (planned !== null) {
        applySelection(selection, planned);
    }

    reportSelection(context, idsAt(collection, selectedPositions(selection)));
}

function observeSelection(
    context: SelectionContext,
    selectedIds: string[] | null | undefined,
    onDrift: () => void,
): void {
    const { selection, collection } = context;

    if (selection === null) {
        return;
    }

    const positions = selectedPositions(selection);
    reportSelection(context, idsAt(collection, positions));

    if (!isCollectionIdle(collection)) {
        return;
    }

    const planned = plannedPositions(context, selectedIds ?? []);

    if (planned !== null && hasSelectionDrifted(positions, planned)) {
        onDrift();
    }
}

function newLastSelection(): LastSelection {
    return { selection: null, key: null };
}

function useSelection(options: SelectionOptions): ReactElement {
    const { collection, selectedIds, onSelectionChanged, selectionMode } = options;
    const [selection, setSelection] = useState<Gtk.SelectionModel | null>(null);
    const [last] = useState<LastSelection>(newLastSelection);
    const context: SelectionContext = { selection, collection, last, onSelectionChanged };

    const markDrift = useControlledSync({
        ids: selectedIds,
        collection,
        widget: selection,
        apply: (ids) => {
            applyControlledSelection(context, ids);
        },
    });

    return selectionElement(selectionMode, {
        ref: setSelection,
        model: collection.model,
        onSelectionChanged: () => {
            observeSelection(context, selectedIds, markDrift);
        },
        onItemsChanged: options.onItemsChanged,
    });
}

export { useSelection };
