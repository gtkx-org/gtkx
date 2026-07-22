import type * as Gtk from "@gtkx/gi/gtk";
import { useMergedRef } from "@gtkx/react/internal";
import { type ReactNode, type Ref, type RefCallback, type RefObject, useRef } from "react";
import type { ItemNode, SectionNode } from "../types.js";
import { type CollectionModelResult, useCollectionModel } from "./use-collection-model.js";
import { useInstalledModel } from "./use-installed-model.js";

export type CollectionWidget = Gtk.Widget & {
    setModel(model: Gtk.SelectionModel | null): void;
};

export type CollectionWidgetInput<W extends CollectionWidget, T, S> = {
    ref?: Ref<W | null> | undefined;
    items?: ItemNode<T>[] | undefined;
    sections?: SectionNode<S, T>[] | undefined;
    selectionMode?: Gtk.SelectionMode | null | undefined;
    selectedIds?: string[] | null | undefined;
    onSelectionChanged?: ((ids: string[]) => void) | null | undefined;
    expandedIds?: string[] | null | undefined;
    onExpandedChange?: ((ids: string[]) => void) | null | undefined;
    renderHeader?: ((info: { section: S }) => ReactNode) | null | undefined;
};

export type CollectionWidgetResult<W extends CollectionWidget, T, S> = {
    widgetRef: RefObject<W | null>;
    setRef: RefCallback<W>;
    collection: CollectionModelResult<T, S>;
};

export const useCollectionWidget = <W extends CollectionWidget, T, S>(
    props: CollectionWidgetInput<W, T, S>,
): CollectionWidgetResult<W, T, S> => {
    const widgetRef = useRef<W | null>(null);
    const setRef = useMergedRef<W>(props.ref, widgetRef);
    const collection = useCollectionModel<T, S>({
        items: props.items,
        sections: props.sections,
        selectionMode: props.selectionMode,
        selectedIds: props.selectedIds,
        onSelectionChanged: props.onSelectionChanged,
        expandedIds: props.expandedIds,
        onExpandedChange: props.onExpandedChange,
        renderHeader: props.renderHeader,
    });
    useInstalledModel(widgetRef, collection.installedModel, (widget, model) => widget.setModel(model));
    return { widgetRef, setRef, collection };
};
