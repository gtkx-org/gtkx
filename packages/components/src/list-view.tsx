import type * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkListView, type GtkListViewProps } from "@gtkx/jsx/gtk";
import type { ReactNode, Ref } from "react";
import { CollectionView, type ModelBinding } from "./collection-view.js";
import type { SlotRenderer } from "./list-slot.js";
import type { ListViewProps } from "./types.js";

const factoryBinding = {
    install: (widget: Gtk.ListView, factory: Gtk.SignalListItemFactory) => widget.setFactory(factory),
    uninstall: (widget: Gtk.ListView) => widget.setFactory(null),
};

const headerFactoryBinding = {
    install: (widget: Gtk.ListView, factory: Gtk.SignalListItemFactory) => widget.setHeaderFactory(factory),
    uninstall: (widget: Gtk.ListView) => widget.setHeaderFactory(null),
};

const modelBinding: ModelBinding<Gtk.ListView> = {
    install: (widget, model) => widget.setModel(model as Gtk.SelectionModel),
};

/**
 * Props for the {@link ListView} component: the raw `GtkListView` element
 * surface with its factory/model wiring replaced by the declarative
 * {@link ListViewProps} API.
 */
export type ListViewComponentProps<T = unknown, S = unknown> = Omit<GtkListViewProps, keyof ListViewProps<T, S>> &
    ListViewProps<T, S>;

/**
 * A `GtkListView` driven by a declarative `items`/`renderItem` API with
 * optional controlled selection, section headers, and tree autoexpansion.
 * Supplying an external `model` switches to the uncontrolled form.
 */
export const ListView = <T = unknown, S = unknown>(props: ListViewComponentProps<T, S>): ReactNode => {
    const {
        ref,
        items,
        model,
        renderItem,
        autoexpand,
        renderHeader,
        selected,
        selectionMode,
        onSelectionChanged,
        estimatedItemHeight,
        estimatedItemWidth,
        ...intrinsicProps
    } = props as ListViewProps<T, S> & {
        ref?: Ref<Gtk.ListView | null>;
        estimatedItemHeight?: number;
        estimatedItemWidth?: number;
        [key: string]: unknown;
    };

    const renderItemFn = renderItem as (item: T, row?: Gtk.TreeListRow | null) => ReactNode;
    const slotRenderer: SlotRenderer<T, S> = (value, treeRow, isHeader) => {
        if (isHeader) return null;
        return treeRow === null ? renderItemFn(value as T) : renderItemFn(value as T, treeRow);
    };

    const useHeader = model === undefined && typeof renderHeader === "function";

    return (
        <CollectionView<T, S, Gtk.ListView>
            element={GtkListView}
            intrinsicProps={intrinsicProps}
            ref={ref}
            items={model === undefined ? items : undefined}
            model={model as Gio.ListModel | undefined}
            renderItem={slotRenderer}
            autoexpand={autoexpand}
            renderHeader={useHeader ? (value) => renderHeader?.(value as S) ?? null : undefined}
            estimatedHeight={estimatedItemHeight}
            estimatedWidth={estimatedItemWidth}
            selected={selected}
            selectionMode={selectionMode}
            onSelectionChanged={onSelectionChanged}
            factoryBinding={factoryBinding}
            headerFactoryBinding={useHeader ? headerFactoryBinding : undefined}
            modelBinding={modelBinding}
        />
    );
};
