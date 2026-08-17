import type * as Gio from "@gtkx/gi/gio";
import type { ReactElement } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkMultiSelection, GtkNoSelection, GtkSingleSelection } from "@gtkx/jsx/gtk";
import { useState } from "react";
import type { Collection } from "./collection.js";
import type { ItemsChangeHandler } from "./expansion.js";
import type { MatchedRows } from "./tree-order.js";
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

type ApplyState = {
    isApplying: boolean;
};

type SelectionContext = {
    selection: Gtk.SelectionModel | null;
    collection: Collection;
    last: LastSelection;
    state: ApplyState;
    onSelectionChanged?: ((ids: string[]) => void) | null | undefined;
};

type PositionRun = {
    start: number;
    length: number;
};

type SelectionElementProps = {
    ref: (value: Gtk.SelectionModel | null) => void;
    model: Gio.ListModel;
    onSelectionChanged: () => void;
    onItemsChanged: ItemsChangeHandler;
};

function contiguousPositions(bitset: Gtk.Bitset, size: number): number[] | null {
    const first = bitset.getMinimum();

    if (bitset.getMaximum() - first + 1 !== size) {
        return null;
    }

    return Array.from({ length: size }, (_, offset) => first + offset);
}

function selectedPositions(selection: Gtk.SelectionModel): number[] {
    const bitset = selection.getSelection();
    const size = Number(bitset.getSize());

    if (size === 0) {
        return [];
    }

    const contiguous = contiguousPositions(bitset, size);

    if (contiguous !== null) {
        return contiguous;
    }

    const positions: number[] = [];

    for (let index = 0; index < size; index++) {
        positions.push(bitset.getNth(index));
    }

    return positions;
}

function plannedSelection(context: SelectionContext, ids: string[]): MatchedRows | null {
    const { selection, collection } = context;

    if (selection === null || selection instanceof Gtk.NoSelection) {
        return null;
    }

    const rows = collection.rowsFor(ids);

    if (ids.length > 0 && rows.positions.length === 0) {
        return null;
    }

    if (selection instanceof Gtk.SingleSelection) {
        return { positions: rows.positions.slice(0, 1), ids: rows.ids.slice(0, 1) };
    }

    return rows;
}

function applySingleSelection(selection: Gtk.SingleSelection, positions: number[]): void {
    const [first] = positions;

    if (first === undefined) {
        selection.unselectAll();

        return;
    }

    selection.selectItem(first, true);
}

function positionRuns(positions: number[]): PositionRun[] {
    const runs: PositionRun[] = [];

    for (const position of positions) {
        const last = runs.at(-1);

        if (last !== undefined && last.start + last.length === position) {
            last.length += 1;
        } else {
            runs.push({ start: position, length: 1 });
        }
    }

    return runs;
}

function positionBitset(positions: number[]): Gtk.Bitset {
    const selected = Gtk.Bitset.newEmpty();

    for (const run of positionRuns(positions)) {
        selected.addRange(run.start, run.length);
    }

    return selected;
}

function applySelection(selection: Gtk.SelectionModel, positions: number[]): Gtk.Bitset {
    const selected = positionBitset(positions);

    if (selection instanceof Gtk.SingleSelection) {
        applySingleSelection(selection, positions);
    } else {
        selection.setSelection(selected, Gtk.Bitset.newRange(0, selection.getNItems()));
    }

    return selected;
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

function didApplyPlanned(context: SelectionContext, selection: Gtk.SelectionModel, positions: number[]): boolean {
    const { state } = context;
    state.isApplying = true;

    try {
        const selected = applySelection(selection, positions);

        return selection.getSelection().equals(selected);
    } finally {
        state.isApplying = false;
    }
}

function applyControlledSelection(context: SelectionContext, selectedIds: string[] | null | undefined): void {
    const { selection, collection } = context;

    if (selection === null) {
        return;
    }

    const planned = plannedSelection(context, selectedIds ?? []);

    if (planned !== null && didApplyPlanned(context, selection, planned.positions)) {
        reportSelection(context, planned.ids);

        return;
    }

    reportSelection(context, collection.idsAt(selectedPositions(selection)));
}

function reportDrift(
    context: SelectionContext,
    selectedIds: string[] | null | undefined,
    positions: number[],
    onDrift: () => void,
): void {
    const planned = plannedSelection(context, selectedIds ?? []);

    if (planned !== null && hasSelectionDrifted(positions, planned.positions)) {
        onDrift();
    }
}

function observeSelection(
    context: SelectionContext,
    selectedIds: string[] | null | undefined,
    onDrift: () => void,
): void {
    const { selection, collection, state } = context;

    if (selection === null || state.isApplying) {
        return;
    }

    const positions = selectedPositions(selection);
    reportSelection(context, collection.idsAt(positions));

    if (isCollectionIdle(collection)) {
        reportDrift(context, selectedIds, positions, onDrift);
    }
}

function newLastSelection(): LastSelection {
    return { selection: null, key: null };
}

function newApplyState(): ApplyState {
    return { isApplying: false };
}

function useSelection(options: SelectionOptions): ReactElement {
    const { collection, selectedIds, onSelectionChanged, selectionMode } = options;
    const [selection, setSelection] = useState<Gtk.SelectionModel | null>(null);
    const [last] = useState<LastSelection>(newLastSelection);
    const [state] = useState<ApplyState>(newApplyState);
    const context: SelectionContext = { selection, collection, last, state, onSelectionChanged };

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
