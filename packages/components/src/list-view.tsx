import type * as Gtk from "@gtkx/gi/gtk";
import { GtkListView, type GtkListViewProps } from "@gtkx/jsx/gtk";
import type { ReactNode, Ref } from "react";
import {
    type CellRenderer,
    CellRenderHost,
    createTreeRenderContext,
    HeaderRenderHost,
    itemRenderer,
    type TreeRenderContext,
} from "./cell.js";
import { makeFactoryInstaller, useCellContainers } from "./hooks/use-cell-containers.js";
import { useCollectionHeader } from "./hooks/use-collection-header.js";
import type {
    CollectionItemSizeProps,
    ControlledExpansionProps,
    ControlledSelectionProps,
    ItemNode,
    RenderItemProps,
    SectionNode,
} from "./types.js";
import type { CellContainerStore } from "./utils/cell-container-store.js";
import type { ItemResolver } from "./utils/item-resolver.js";

const factoryInstaller = makeFactoryInstaller<Gtk.ListView>((widget, factory) => widget.setFactory(factory));

const headerFactoryInstaller = makeFactoryInstaller<Gtk.ListView>((widget, factory) =>
    widget.setHeaderFactory(factory),
);

export type ListViewDeclarativeProps<T = unknown, S = unknown> = CollectionItemSizeProps &
    ControlledSelectionProps &
    ControlledExpansionProps & {
        items?: ItemNode<T>[] | undefined;
        sections?: SectionNode<S, T>[] | undefined;
        renderItem: (props: RenderItemProps<T>) => ReactNode;
        renderHeader?: ((info: { section: S }) => ReactNode) | null | undefined;
    };

/**
 * Props for {@link ListView}. Combines the underlying Gtk.ListView props with
 * declarative collection props: flat items or grouped sections, a per-row renderItem,
 * an optional section header renderer, controlled selection and expansion, and
 * estimated item sizing.
 */
export type ListViewProps<T = unknown, S = unknown> = Omit<
    GtkListViewProps,
    "model" | "factory" | "headerFactory" | keyof ListViewDeclarativeProps<T, S>
> &
    ListViewDeclarativeProps<T, S>;

interface ListViewWiring<T, S> {
    setRef: (value: Gtk.ListView | null) => void;
    resolver: ItemResolver<T, S>;
    headerResolver: ItemResolver<T, S>;
    itemStore: CellContainerStore;
    headerStore: CellContainerStore;
    useHeader: boolean;
    rowId: (row: Gtk.TreeListRow) => string | undefined;
}

const useListViewWiring = <T, S>(props: NormalizedListViewProps<T, S>): ListViewWiring<T, S> => {
    const { widgetRef, setRef, collection, useHeader, headerStore } = useCollectionHeader<Gtk.ListView, T, S>(
        props,
        headerFactoryInstaller,
    );

    const itemStore = useCellContainers<Gtk.ListView>({
        object: widgetRef,
        installer: factoryInstaller,
        estimatedHeight: props.estimatedItemHeight,
        estimatedWidth: props.estimatedItemWidth,
    });

    return {
        setRef,
        resolver: collection.resolver,
        headerResolver: collection.headerResolver,
        itemStore,
        headerStore,
        useHeader,
        rowId: collection.rowId,
    };
};

type NormalizedListViewProps<T, S> = ListViewDeclarativeProps<T, S> & {
    ref?: Ref<Gtk.ListView | null>;
    estimatedItemHeight?: number;
    estimatedItemWidth?: number;
    [key: string]: unknown;
};

/**
 * Renders a Gtk.ListView: a scrollable, single-column list backed by a collection
 * model, with each row drawn by renderItem and optional section headers.
 */
export const ListView = <T = unknown, S = unknown>(props: ListViewProps<T, S>): ReactNode => {
    const {
        ref,
        items,
        sections,
        renderItem,
        renderHeader,
        selectedIds,
        selectionMode,
        onSelectionChanged,
        expandedIds,
        onExpandedChange,
        estimatedItemHeight,
        estimatedItemWidth,
        ...intrinsicProps
    } = props as NormalizedListViewProps<T, S>;

    const wiring = useListViewWiring<T, S>({
        ref,
        items,
        sections,
        renderHeader,
        selectedIds,
        selectionMode,
        onSelectionChanged,
        expandedIds,
        onExpandedChange,
        estimatedItemHeight,
        estimatedItemWidth,
    } as NormalizedListViewProps<T, S>);

    const treeContext: TreeRenderContext = createTreeRenderContext(expandedIds, wiring.rowId);
    const cellRenderer: CellRenderer<T, S> = itemRenderer<T, S>(renderItem, treeContext);

    return (
        <>
            <GtkListView {...intrinsicProps} ref={wiring.setRef} />
            <CellRenderHost store={wiring.itemStore} resolver={wiring.resolver} render={cellRenderer} />
            <HeaderRenderHost
                useHeader={wiring.useHeader}
                store={wiring.headerStore}
                resolver={wiring.headerResolver}
                renderHeader={renderHeader}
            />
        </>
    );
};
