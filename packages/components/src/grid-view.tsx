import type * as Gtk from "@gtkx/gi/gtk";
import { GtkGridView, type GtkGridViewProps } from "@gtkx/jsx/gtk";
import { useMergeRefs } from "@gtkx/react";
import { type ReactNode, type Ref, useRef } from "react";
import { type CellRenderer, CellRenderHost, itemRenderer } from "./cell.js";
import { type FactoryInstaller, useCellContainers } from "./hooks/use-cell-containers.js";
import { useCollectionModel } from "./hooks/use-collection-model.js";
import { useInstalledModel } from "./hooks/use-installed-model.js";
import type { CollectionItemSizeProps, ControlledSelectionProps, ItemNode, RenderItemProps } from "./types.js";

const factoryInstaller: FactoryInstaller<Gtk.GridView> = {
    install: (widget: Gtk.GridView, factory: Gtk.SignalListItemFactory) => widget.setFactory(factory),
    uninstall: (widget: Gtk.GridView) => widget.setFactory(null),
};

type GridViewDeclarativeProps<T = unknown> = CollectionItemSizeProps &
    ControlledSelectionProps & {
        items?: ItemNode<T>[] | undefined;
        renderItem: (props: RenderItemProps<T>) => ReactNode;
    };

export type GridViewProps<T = unknown> = Omit<
    GtkGridViewProps,
    "model" | "factory" | keyof GridViewDeclarativeProps<T>
> &
    GridViewDeclarativeProps<T>;

export const GridView = <T = unknown>(props: GridViewProps<T>): ReactNode => {
    const {
        ref,
        items,
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

    const cellRenderer: CellRenderer<T, unknown> = itemRenderer<T, unknown>(renderItem);

    const widgetRef = useRef<Gtk.GridView | null>(null);
    const setRef = useMergeRefs<Gtk.GridView>(ref, widgetRef);

    const collection = useCollectionModel<T, unknown>({
        items,
        sections: undefined,
        selectionMode,
        selectedIds,
        onSelectionChanged,
        renderHeader: undefined,
    });

    const itemStore = useCellContainers<Gtk.GridView>({
        target: widgetRef,
        installer: factoryInstaller,
        estimatedHeight: estimatedItemHeight,
        estimatedWidth: estimatedItemWidth,
    });

    useInstalledModel(widgetRef, collection.installedModel, (widget, value) => widget.setModel(value));

    return (
        <>
            <GtkGridView {...intrinsicProps} ref={setRef} />
            <CellRenderHost store={itemStore} resolver={collection.resolver} render={cellRenderer} />
        </>
    );
};
