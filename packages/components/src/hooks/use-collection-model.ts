import type * as Gtk from "@gtkx/gi/gtk";
import { type ReactNode, useCallback } from "react";
import type { ItemNode, SectionNode } from "../types.js";
import { type ItemResolver, rowIdOf } from "../utils/item-resolver.js";
import { useExpansionModel } from "./use-expansion-model.js";
import { useListModel } from "./use-list-model.js";
import { useSelectionModel } from "./use-selection-model.js";

type CollectionModelInput<T, S> = {
    items: ItemNode<T>[] | undefined;
    sections: SectionNode<S, T>[] | undefined;
    selectionMode: Gtk.SelectionMode | null | undefined;
    selectedIds: string[] | null | undefined;
    onSelectionChanged: ((ids: string[]) => void) | null | undefined;
    expandedIds?: string[] | null | undefined;
    onExpandedChange?: ((ids: string[]) => void) | null | undefined;
    renderHeader: ((info: { section: S }) => ReactNode) | null | undefined;
};

export type CollectionModelResult<T, S> = {
    resolver: ItemResolver<T, S>;
    headerResolver: ItemResolver<T, S>;
    installedModel: Gtk.SelectionModel;
    useHeader: boolean;
    rowId: (row: Gtk.TreeListRow) => string | undefined;
};

export const useCollectionModel = <T, S>(input: CollectionModelInput<T, S>): CollectionModelResult<T, S> => {
    const listModel = useListModel<T, S>({
        items: input.items,
        sections: input.sections,
    });

    useExpansionModel<T>({
        treeModel: listModel.treeModel,
        rowValues: listModel.rowValues,
        expandedIds: input.expandedIds,
        onExpandedChange: input.onExpandedChange,
    });

    const installedModel = useSelectionModel<T, S>({
        base: listModel.model,
        resolver: listModel.resolver,
        selectionMode: input.selectionMode,
        selectedIds: input.selectedIds,
        onSelectionChanged: input.onSelectionChanged,
    });

    const useHeader = typeof input.renderHeader === "function";
    const { rowValues } = listModel;
    const rowId = useCallback((row: Gtk.TreeListRow): string | undefined => rowIdOf(rowValues, row), [rowValues]);

    return {
        resolver: listModel.resolver,
        headerResolver: listModel.headerResolver,
        installedModel,
        useHeader,
        rowId,
    };
};
