import type * as Gtk from "@gtkx/gi/gtk";
import { GtkListView, type GtkListViewProps } from "@gtkx/jsx/gtk";
import { useMergeRefs } from "@gtkx/react";
import { type ReactNode, type Ref, useRef } from "react";
import { type CellRenderer, CellRenderHost, HeaderRenderHost, itemRenderer, type TreeRenderContext } from "./cell.js";
import { type FactoryInstaller, useCellContainers } from "./hooks/use-cell-containers.js";
import { useCollectionModel } from "./hooks/use-collection-model.js";
import { useInstalledModel } from "./hooks/use-installed-model.js";
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

const factoryInstaller: FactoryInstaller<Gtk.ListView> = {
    install: (widget: Gtk.ListView, factory: Gtk.SignalListItemFactory) => widget.setFactory(factory),
    uninstall: (widget: Gtk.ListView) => widget.setFactory(null),
};

const headerFactoryInstaller: FactoryInstaller<Gtk.ListView> = {
    install: (widget: Gtk.ListView, factory: Gtk.SignalListItemFactory) => widget.setHeaderFactory(factory),
    uninstall: (widget: Gtk.ListView) => widget.setHeaderFactory(null),
};

type ListViewDeclarativeProps<T = unknown, S = unknown> = CollectionItemSizeProps &
    ControlledSelectionProps &
    ControlledExpansionProps & {
        items?: ItemNode<T>[] | undefined;
        sections?: SectionNode<S, T>[] | undefined;
        renderItem: (props: RenderItemProps<T>) => ReactNode;
        renderHeader?: ((info: { section: S }) => ReactNode) | null | undefined;
    };

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
    const widgetRef = useRef<Gtk.ListView | null>(null);
    const setRef = useMergeRefs<Gtk.ListView>(props.ref, widgetRef);

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

    const useHeader = collection.useHeader;

    const itemStore = useCellContainers<Gtk.ListView>({
        target: widgetRef,
        installer: factoryInstaller,
        estimatedHeight: props.estimatedItemHeight,
        estimatedWidth: props.estimatedItemWidth,
    });
    const headerStore = useCellContainers<Gtk.ListView>({
        target: useHeader ? widgetRef : null,
        installer: headerFactoryInstaller,
        estimatedHeight: props.estimatedItemHeight,
        estimatedWidth: props.estimatedItemWidth,
    });

    useInstalledModel(widgetRef, collection.installedModel, (widget, value) => widget.setModel(value));

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

    const treeContext: TreeRenderContext = {
        controlled: expandedIds !== undefined && expandedIds !== null,
        expandedIds: new Set(expandedIds ?? []),
        rowId: wiring.rowId,
    };
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
