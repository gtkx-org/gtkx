import type * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import type { ReactNode } from "react";
import type { ItemNode, SectionNode } from "../types.js";
import type { ItemResolver } from "../utils/item-resolver.js";
import { useControlledSelectionModel } from "./use-controlled-selection-model.js";
import { useListModel } from "./use-list-model.js";

type CollectionModelInput<T, S> = {
    model: Gio.ListModel | undefined;
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
    const externalModel = input.model;
    const listModel = useListModel<T, S>(
        externalModel === undefined
            ? { items: input.items, sections: input.sections, autoexpand: input.autoexpand }
            : { model: externalModel },
    );

    const installedModel = useControlledSelectionModel<T, S>(externalModel, {
        base: listModel.model,
        resolver: listModel.resolver,
        selectionMode: input.selectionMode,
        selectedIds: input.selectedIds,
        onSelectionChanged: input.onSelectionChanged,
    });

    const useHeader = externalModel === undefined && typeof input.renderHeader === "function";

    return { resolver: listModel.resolver, headerResolver: listModel.headerResolver, installedModel, useHeader };
};
