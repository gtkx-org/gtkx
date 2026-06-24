import type * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkGridView, type GtkGridViewProps } from "@gtkx/jsx/gtk";
import type { ReactNode, Ref } from "react";
import { CollectionView, type ModelInstaller } from "./collection-view.js";
import type { CellRenderer } from "./list-cell.js";
import type { GridViewProps } from "./types.js";

const factoryInstaller = {
    install: (widget: Gtk.GridView, factory: Gtk.SignalListItemFactory) => widget.setFactory(factory),
    uninstall: (widget: Gtk.GridView) => widget.setFactory(null),
};

const modelInstaller: ModelInstaller<Gtk.GridView> = {
    install: (widget, model) => widget.setModel(model as Gtk.SelectionModel),
};

/**
 * Props for the {@link GridView} component: the raw `GtkGridView` element
 * surface with its factory/model wiring replaced by the declarative
 * {@link GridViewProps} API.
 */
export type GridViewComponentProps<T = unknown> = Omit<GtkGridViewProps, keyof GridViewProps<T>> & GridViewProps<T>;

/**
 * A `GtkGridView` driven by a declarative `items`/`renderItem` API with
 * optional controlled selection. Supplying an external `model` switches to the
 * uncontrolled form.
 */
export const GridView = <T = unknown>(props: GridViewComponentProps<T>): ReactNode => {
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
            selected={selected}
            selectionMode={selectionMode}
            onSelectionChanged={onSelectionChanged}
            factoryInstaller={factoryInstaller}
            headerFactoryInstaller={undefined}
            modelInstaller={modelInstaller}
        />
    );
};
