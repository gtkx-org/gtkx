import type * as Gio from "@gtkx/gi/gio";
import type * as GObject from "@gtkx/gi/gobject";
import type { ReactElement } from "react";
import type { RefObject } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkMultiSelection, GtkNoSelection, GtkSingleSelection } from "@gtkx/jsx/gtk";
import { useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Item, Section } from "../types.js";
import {
    type CollectionMode,
    type CollectionModel,
    createCollectionModel,
    getCollectionMode,
} from "./collection-model.js";
import { type Cells, type CellSize, useCells } from "./use-cells.js";

type CollectionOptions = {
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

type Collection = {
    model: CollectionModel;
    cells: Cells;
    selection: ReactElement;
};

type SelectionElementProps = {
    ref: (value: Gtk.SelectionModel | null) => void;
    model: Gio.ListModel;
    onSelectionChanged: () => void;
};

type LastSelection = { selection: Gtk.SelectionModel | null; key: string | null };

type SelectionReport = {
    selection: Gtk.SelectionModel | null;
    model: CollectionModel;
    cells: Cells;
    onSelectionChanged: ((ids: string[]) => void) | null | undefined;
};

type ExpansionReport = {
    model: CollectionModel;
    last: RefObject<string>;
    onExpandedChange: ((ids: string[]) => void) | null | undefined;
};

type DataSync = { model: CollectionModel; cells: Cells; items: Item[] | undefined; sections: Section[] | undefined };

type ExpansionSync = DataSync & {
    expandedIds: string[] | null | undefined;
    onExpandedChange: ((ids: string[]) => void) | null | undefined;
};

type SelectionSync = {
    model: CollectionModel;
    selection: Gtk.SelectionModel | null;
    cells: Cells;
    items: Item[] | undefined;
    sections: Section[] | undefined;
    selectedIds: string[] | null | undefined;
    onSelectionChanged: ((ids: string[]) => void) | null | undefined;
};

const lastSelections: WeakMap<Cells, LastSelection> = new WeakMap();

const getSelectedIds = (selection: Gtk.SelectionModel, model: CollectionModel): string[] => {
    const bitset = selection.getSelection();
    const size = Number(bitset.getSize());
    const ids: string[] = [];

    for (let index = 0; index < size; index++) {
        const id = model.idAt(bitset.getNth(index));

        if (id !== null) {
            ids.push(id);
        }
    }

    return ids;
};

const applySingleSelection = (selection: Gtk.SingleSelection, positions: number[]): void => {
    const [first] = positions;

    if (first === undefined) {
        selection.unselectAll();
    } else {
        selection.selectItem(first, true);
    }
};

const applyMultiSelection = (selection: Gtk.SelectionModel, positions: number[]): void => {
    const selected = Gtk.Bitset.newEmpty();

    for (const position of positions) {
        selected.add(position);
    }

    selection.setSelection(selected, Gtk.Bitset.newRange(0, selection.getNItems()));
};

const applySelection = (selection: Gtk.SelectionModel, model: CollectionModel, ids: string[]): void => {
    if (selection instanceof Gtk.NoSelection) {
        return;
    }

    const positions = model.positionsFor(ids);

    if (ids.length > 0 && positions.length === 0) {
        return;
    }

    if (selection instanceof Gtk.SingleSelection) {
        applySingleSelection(selection, positions);

        return;
    }

    applyMultiSelection(selection, positions);
};

const rowId = (model: CollectionModel, holder: GObject.Object | null): string | null =>
    holder === null ? null : (model.entryFor(holder)?.id ?? null);

const eachRow = (
    tree: Gtk.TreeListModel,
    model: CollectionModel,
    visit: (row: Gtk.TreeListRow, id: string | null) => void,
): void => {
    for (let position = 0; position < tree.getNItems(); position++) {
        const row = tree.getRow(position);

        if (row === null) {
            continue;
        }

        visit(row, rowId(model, row.getItem()));
    }
};

const reportSelection = (report: SelectionReport): void => {
    const { selection, model, cells } = report;

    if (selection === null) {
        return;
    }

    const ids = getSelectedIds(selection, model);
    const key = ids.join(" ");
    const last = lastSelections.get(cells);

    if (last?.selection === selection && last.key === key) {
        return;
    }

    lastSelections.set(cells, { selection, key });
    report.onSelectionChanged?.(ids);
};

const reportExpansion = (report: ExpansionReport): void => {
    const tree = report.model.treeModel;

    if (tree === null) {
        return;
    }

    const ids: string[] = [];

    eachRow(tree, report.model, (row, id) => {
        if (id !== null && row.getExpanded()) {
            ids.push(id);
        }
    });

    const key = ids.join(" ");

    if (report.last.current === key) {
        return;
    }

    report.last.current = key;
    report.onExpandedChange?.(ids);
};

const selectionElement = (mode: Gtk.SelectionMode | null | undefined, props: SelectionElementProps): ReactElement => {
    if (mode === Gtk.SelectionMode.MULTIPLE) {
        return <GtkMultiSelection {...props} />;
    }

    if (mode === Gtk.SelectionMode.NONE) {
        return <GtkNoSelection {...props} />;
    }

    return <GtkSingleSelection {...props} autoselect={false} canUnselect />;
};

const useCollectionModel = (mode: CollectionMode): CollectionModel =>
    useMemo(() => createCollectionModel(mode), [mode]);

const useDataSync = ({ model, cells, items, sections }: DataSync): void => {
    useLayoutEffect(() => {
        model.update({ items, sections });
        cells.refresh();
    }, [model, cells, items, sections]);
};

const applyExpansion = (tree: Gtk.TreeListModel, model: CollectionModel, expandedIds: string[]): void => {
    const wanted = new Set(expandedIds);

    eachRow(tree, model, (row, id) => {
        const isDesired = id !== null && wanted.has(id);

        if (row.isExpandable() && row.getExpanded() !== isDesired) {
            row.setExpanded(isDesired);
        }
    });
};

const watchExpansion = (tree: Gtk.TreeListModel, cells: Cells, report: () => void): (() => void) => {
    const handler = (): void => {
        cells.refresh();
        report();
    };

    tree.on("items-changed", handler);

    return () => {
        tree.off("items-changed", handler);
    };
};

const runControlledExpansion = (
    model: CollectionModel,
    expandedIds: string[] | null | undefined,
    expanding: RefObject<boolean>,
    report: () => void,
): void => {
    const tree = model.treeModel;

    if (tree === null || expandedIds == null) {
        return;
    }

    expanding.current = true;

    try {
        applyExpansion(tree, model, expandedIds);
    } finally {
        expanding.current = false;
    }

    report();
};

const useControlledExpansion = (sync: ExpansionSync): void => {
    const { model, cells, items, sections, expandedIds, onExpandedChange } = sync;
    const lastExpansion = useRef("");
    const expanding = useRef(false);

    const report = useEffectEvent((): void => {
        if (expanding.current) {
            return;
        }

        reportExpansion({ model, last: lastExpansion, onExpandedChange });
    });

    useLayoutEffect(() => {
        const tree = model.treeModel;

        if (tree === null) {
            return;
        }

        return watchExpansion(tree, cells, report);
    }, [model, cells]);

    useLayoutEffect(() => {
        runControlledExpansion(model, expandedIds, expanding, report);
    }, [model, expandedIds, items, sections]);
};

const useControlledSelection = (sync: SelectionSync): void => {
    const { model, selection, cells, items, sections, selectedIds, onSelectionChanged } = sync;

    const report = useEffectEvent((): void => {
        reportSelection({ selection, model, cells, onSelectionChanged });
    });

    useLayoutEffect(() => {
        if (selection === null) {
            return;
        }

        if (selectedIds != null) {
            applySelection(selection, model, selectedIds);
        }

        report();
    }, [selection, model, selectedIds, items, sections]);
};

const useCollection = (options: CollectionOptions): Collection => {
    const { items, sections, selectionMode, selectedIds, expandedIds, onSelectionChanged, onExpandedChange } = options;
    const model = useCollectionModel(options.mode ?? getCollectionMode({ items, sections }));
    const cells = useCells(options.size);
    const [selection, setSelection] = useState<Gtk.SelectionModel | null>(null);
    useDataSync({ model, cells, items, sections });
    useControlledExpansion({ model, cells, items, sections, expandedIds, onExpandedChange });
    useControlledSelection({ model, selection, cells, items, sections, selectedIds, onSelectionChanged });

    return {
        model,
        cells,
        selection: selectionElement(selectionMode, {
            ref: setSelection,
            model: model.model,
            onSelectionChanged: () => {
                reportSelection({ selection, model, cells, onSelectionChanged });
            },
        }),
    };
};

export { useCollectionModel, useCollection, type CollectionOptions, type Collection };
