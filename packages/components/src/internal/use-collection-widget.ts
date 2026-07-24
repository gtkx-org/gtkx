import type * as Gtk from "@gtkx/gi/gtk";
import type { Ref, RefCallback } from "react";
import type { ItemNode, SectionNode } from "../types.js";
import type { CollectionMode } from "./collection-source.js";
import { type CellHarness, useCellHarness } from "./use-cell-harness.js";
import { type CollectionView, type ModelHost, useCollectionView } from "./use-collection-view.js";
import { useWidgetRef } from "./use-widget-ref.js";

type CollectionWidgetProps<W> = {
    ref?: Ref<W | null> | undefined;
    items?: ItemNode<unknown>[] | undefined;
    sections?: SectionNode<unknown, unknown>[] | undefined;
    selectedIds?: string[] | null | undefined;
    onSelectionChanged?: ((ids: string[]) => void) | null | undefined;
    selectionMode?: Gtk.SelectionMode | null | undefined;
    expandedIds?: string[] | null | undefined;
    onExpandedChange?: ((ids: string[]) => void) | null | undefined;
    estimatedItemHeight?: number | undefined;
    estimatedItemWidth?: number | undefined;
};

type CollectionWidget<W> = {
    widget: W | null;
    refCallback: RefCallback<W | null>;
    harness: CellHarness;
    view: CollectionView;
};

export const useCollectionWidget = <W extends ModelHost>(
    props: CollectionWidgetProps<W>,
    forcedMode?: CollectionMode,
): CollectionWidget<W> => {
    const [widget, refCallback] = useWidgetRef<W>(props.ref);
    const harness = useCellHarness({
        width: props.estimatedItemWidth ?? -1,
        height: props.estimatedItemHeight ?? -1,
    });
    const view = useCollectionView({
        widget,
        tracker: harness.tracker,
        items: props.items,
        sections: props.sections,
        forcedMode,
        selectedIds: props.selectedIds,
        onSelectionChanged: props.onSelectionChanged,
        selectionMode: props.selectionMode,
        expandedIds: props.expandedIds,
        onExpandedChange: props.onExpandedChange,
    });
    harness.connect(view.api);
    return { widget, refCallback, harness, view };
};
