import type * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkListView, type GtkListViewProps } from "@gtkx/jsx/gtk";
import type { ReactNode, Ref } from "react";
import type { CellRenderer } from "./cell.js";
import { CollectionView, type ModelInstaller } from "./collection-view.js";
import type { FactoryInstaller } from "./hooks/use-cell-containers.js";
import type { ItemNode, ListViewControlledSelectionProps, ListViewSharedProps, UncontrolledItemType } from "./types.js";

const factoryInstaller: FactoryInstaller<Gtk.ListView> = {
    install: (widget: Gtk.ListView, factory: Gtk.SignalListItemFactory) => widget.setFactory(factory),
    uninstall: (widget: Gtk.ListView) => widget.setFactory(null),
};

const headerFactoryInstaller: FactoryInstaller<Gtk.ListView> = {
    install: (widget: Gtk.ListView, factory: Gtk.SignalListItemFactory) => widget.setHeaderFactory(factory),
    uninstall: (widget: Gtk.ListView) => widget.setHeaderFactory(null),
};

const modelInstaller: ModelInstaller<Gtk.ListView> = {
    install: (widget, model) => widget.setModel(model as Gtk.SelectionModel),
};

/**
 * Props for the {@link ListView} component, replacing the raw `GtkListView`
 * factory/model surface with a declarative `items`/`renderItem` API, optional
 * controlled selection, section headers, and tree autoexpansion. Supplying an
 * external `model` switches to the uncontrolled form.
 */
export type ListViewDeclarativeProps<T = unknown, S = unknown> = ListViewSharedProps &
    (
        | (ListViewControlledSelectionProps & {
              items?: ItemNode<T, S>[] | undefined;
              renderItem: (item: T, row?: Gtk.TreeListRow | null) => ReactNode;
              autoexpand?: boolean | undefined;
              renderHeader?: ((item: S) => ReactNode) | null | undefined;
              model?: never;
          })
        | {
              model: Gio.ListModel;
              renderItem: (item: UncontrolledItemType<T>) => ReactNode;
              items?: never;
              autoexpand?: never;
              renderHeader?: never;
              selectedIds?: never;
              onSelectionChanged?: never;
              selectionMode?: never;
          }
    );

/**
 * Props for the {@link ListView} component: the raw `GtkListView` element
 * surface with its factory/model wiring replaced by the declarative
 * {@link ListViewDeclarativeProps} API.
 */
export type ListViewProps<T = unknown, S = unknown> = Omit<GtkListViewProps, keyof ListViewDeclarativeProps<T, S>> &
    ListViewDeclarativeProps<T, S>;

/**
 * A `GtkListView` driven by a declarative `items`/`renderItem` API with
 * optional controlled selection, section headers, and tree autoexpansion.
 * Supplying an external `model` switches to the uncontrolled form.
 */
export const ListView = <T = unknown, S = unknown>(props: ListViewProps<T, S>): ReactNode => {
    const {
        ref,
        items,
        model,
        renderItem,
        autoexpand,
        renderHeader,
        selectedIds,
        selectionMode,
        onSelectionChanged,
        estimatedItemHeight,
        estimatedItemWidth,
        ...intrinsicProps
    } = props as ListViewDeclarativeProps<T, S> & {
        ref?: Ref<Gtk.ListView | null>;
        estimatedItemHeight?: number;
        estimatedItemWidth?: number;
        [key: string]: unknown;
    };

    const renderItemFn = renderItem as (item: T, row?: Gtk.TreeListRow | null) => ReactNode;
    const cellRenderer: CellRenderer<T, S> = (value, treeRow, isHeader) => {
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
            renderItem={cellRenderer}
            autoexpand={autoexpand}
            renderHeader={useHeader ? (value) => renderHeader?.(value as S) ?? null : undefined}
            estimatedHeight={estimatedItemHeight}
            estimatedWidth={estimatedItemWidth}
            selectedIds={selectedIds}
            selectionMode={selectionMode}
            onSelectionChanged={onSelectionChanged}
            factoryInstaller={factoryInstaller}
            headerFactoryInstaller={useHeader ? headerFactoryInstaller : undefined}
            modelInstaller={modelInstaller}
        />
    );
};
