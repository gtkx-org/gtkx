import type * as Gtk from "@gtkx/gi/gtk";
import type { ReactNode } from "react";
import type { ItemNode, SectionNode } from "../types.js";
import type { ItemResolver } from "../utils/item-resolver.js";
import { useListModel } from "./use-list-model.js";
import { useSelectionModel } from "./use-selection-model.js";

type CollectionModelInput<T, S> = {
    items: ItemNode<T>[] | undefined;
    sections: SectionNode<S, T>[] | undefined;
    autoexpand?: boolean | undefined;
    selectionMode: Gtk.SelectionMode | null | undefined;
    selectedIds: string[] | null | undefined;
    onSelectionChanged: ((ids: string[]) => void) | null | undefined;
    renderHeader: ((info: { section: S }) => ReactNode) | null | undefined;
};

type CollectionModelResult<T, S> = {
    resolver: ItemResolver<T, S>;
    headerResolver: ItemResolver<T, S>;
    installedModel: Gtk.SelectionModel;
    useHeader: boolean;
};

export const useCollectionModel = <T, S>(input: CollectionModelInput<T, S>): CollectionModelResult<T, S> => {
    const listModel = useListModel<T, S>({
        items: input.items,
        sections: input.sections,
        autoexpand: input.autoexpand,
    });

    const installedModel = useSelectionModel<T, S>({
        base: listModel.model,
        resolver: listModel.resolver,
        selectionMode: input.selectionMode,
        selectedIds: input.selectedIds,
        onSelectionChanged: input.onSelectionChanged,
    });

    const useHeader = typeof input.renderHeader === "function";

    return { resolver: listModel.resolver, headerResolver: listModel.headerResolver, installedModel, useHeader };
};
