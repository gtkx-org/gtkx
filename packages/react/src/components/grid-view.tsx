import type * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import type { ReactNode, Ref } from "react";
import type { GridViewProps } from "../utils/element-props.js";
import { CollectionView, type ModelBinding } from "./collection-view.js";
import type { SlotRenderer } from "./list-slot.js";

const GRID_VIEW_ELEMENT = "GtkGridView";

const factoryBinding = {
    install: (widget: Gtk.GridView, factory: Gtk.SignalListItemFactory) => widget.setFactory(factory),
    uninstall: (widget: Gtk.GridView) => widget.setFactory(null),
};

const modelBinding: ModelBinding<Gtk.GridView> = {
    install: (widget, model) => widget.setModel(model as Gtk.SelectionModel),
};

type GridViewComponentProps<T> = GridViewProps<T> & {
    ref?: Ref<Gtk.GridView | null> | undefined;
    estimatedItemHeight?: number | undefined;
    estimatedItemWidth?: number | undefined;
};

export const GtkGridView = <T = unknown>(props: GridViewComponentProps<T>): ReactNode => {
    const {
        ref,
        items,
        model,
        renderItem,
        selected,
        selectionMode,
        onSelectionChanged,
        estimatedItemHeight,
        estimatedItemWidth,
        ...intrinsicProps
    } = props as GridViewProps<T> & {
        ref?: Ref<Gtk.GridView | null>;
        estimatedItemHeight?: number;
        estimatedItemWidth?: number;
        [key: string]: unknown;
    };

    const renderItemFn = renderItem as (item: T) => ReactNode;
    const slotRenderer: SlotRenderer<T, unknown> = (value, _treeRow, isHeader) =>
        isHeader ? null : renderItemFn(value as T);

    return (
        <CollectionView<T, unknown, Gtk.GridView>
            element={GRID_VIEW_ELEMENT}
            intrinsicProps={intrinsicProps}
            ref={ref}
            items={model === undefined ? items : undefined}
            model={model as Gio.ListModel | undefined}
            renderItem={slotRenderer}
            autoexpand={undefined}
            renderHeader={undefined}
            estimatedHeight={estimatedItemHeight}
            estimatedWidth={estimatedItemWidth}
            selected={selected}
            selectionMode={selectionMode}
            onSelectionChanged={onSelectionChanged}
            factoryBinding={factoryBinding}
            headerFactoryBinding={undefined}
            modelBinding={modelBinding}
        />
    );
};
