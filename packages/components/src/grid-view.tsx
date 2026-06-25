import type * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkGridView, type GtkGridViewProps } from "@gtkx/jsx/gtk";
import type { ReactNode, Ref } from "react";
import type { CellRenderer } from "./cell.js";
import { CollectionView, type ModelInstaller } from "./collection-view.js";
import type { FactoryInstaller } from "./hooks/use-cell-containers.js";
import type { ItemNode, ListViewControlledSelectionProps, ListViewSharedProps, UncontrolledItemType } from "./types.js";

const factoryInstaller: FactoryInstaller<Gtk.GridView> = {
    install: (widget: Gtk.GridView, factory: Gtk.SignalListItemFactory) => widget.setFactory(factory),
    uninstall: (widget: Gtk.GridView) => widget.setFactory(null),
};

const modelInstaller: ModelInstaller<Gtk.GridView> = {
    install: (widget, model) => widget.setModel(model as Gtk.SelectionModel),
};

/**
 * Props for the {@link GridView} component, replacing the raw `GtkGridView`
 * factory/model surface with a declarative `items`/`renderItem` API and
 * optional controlled selection. Supplying an external `model` switches to the
 * uncontrolled form.
 */
export type GridViewDeclarativeProps<T = unknown> = ListViewSharedProps &
    (
        | (ListViewControlledSelectionProps & {
              items?: ItemNode<T>[] | undefined;
              renderItem: (item: T) => ReactNode;
              model?: never;
          })
        | {
              model: Gio.ListModel;
              renderItem: (item: UncontrolledItemType<T>) => ReactNode;
              items?: never;
              selectedIds?: never;
              onSelectionChanged?: never;
              selectionMode?: never;
          }
    );

/**
 * Props for the {@link GridView} component: the raw `GtkGridView` element
 * surface with its factory/model wiring replaced by the declarative
 * {@link GridViewDeclarativeProps} API.
 */
export type GridViewProps<T = unknown> = Omit<GtkGridViewProps, keyof GridViewDeclarativeProps<T>> &
    GridViewDeclarativeProps<T>;

/**
 * A `GtkGridView` driven by a declarative `items`/`renderItem` API with
 * optional controlled selection. Supplying an external `model` switches to the
 * uncontrolled form.
 */
export const GridView = <T = unknown>(props: GridViewProps<T>): ReactNode => {
    const {
        ref,
        items,
        model,
        renderItem,
        selectedIds,
        selectionMode,
        onSelectionChanged,
        estimatedItemHeight,
        estimatedItemWidth,
        ...intrinsicProps
    } = props as GridViewDeclarativeProps<T> & {
        ref?: Ref<Gtk.GridView | null>;
        estimatedItemHeight?: number;
        estimatedItemWidth?: number;
        [key: string]: unknown;
    };

    const renderItemFn = renderItem as (item: T) => ReactNode;
    const cellRenderer: CellRenderer<T, unknown> = (value, _treeRow, isHeader) =>
        isHeader ? null : renderItemFn(value as T);

    return (
        <CollectionView<T, unknown, Gtk.GridView>
            element={GtkGridView}
            intrinsicProps={intrinsicProps}
            ref={ref}
            items={model === undefined ? items : undefined}
            model={model as Gio.ListModel | undefined}
            renderItem={cellRenderer}
            autoexpand={undefined}
            renderHeader={undefined}
            estimatedHeight={estimatedItemHeight}
            estimatedWidth={estimatedItemWidth}
            selectedIds={selectedIds}
            selectionMode={selectionMode}
            onSelectionChanged={onSelectionChanged}
            factoryInstaller={factoryInstaller}
            headerFactoryInstaller={undefined}
            modelInstaller={modelInstaller}
        />
    );
};
