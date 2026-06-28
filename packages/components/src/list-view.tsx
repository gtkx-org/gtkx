import type * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkListView, type GtkListViewProps } from "@gtkx/jsx/gtk";
import { useMergeRefs } from "@gtkx/react";
import { createElement, type ReactElement, type ReactNode, type Ref, useRef } from "react";
import { type CellRenderer, CellRenderHost, headerRenderer } from "./cell.js";
import { type FactoryInstaller, useCellContainers } from "./hooks/use-cell-containers.js";
import { useControlledSelectionModel } from "./hooks/use-controlled-selection-model.js";
import { useInstalledModel } from "./hooks/use-installed-model.js";
import { useListModel } from "./hooks/use-list-model.js";
import type {
    CollectionItemSizeProps,
    ControlledSelectionProps,
    ItemNode,
    RenderItemInfo,
    SectionNode,
    UncontrolledItemType,
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

export interface ListRenderItemInfo<T> extends RenderItemInfo<T> {
    depth: number;
    isExpanded: boolean;
}

type ListViewDeclarativeProps<T = unknown, S = unknown> = CollectionItemSizeProps &
    (
        | (ControlledSelectionProps & {
              items?: ItemNode<T>[] | undefined;
              sections?: SectionNode<S, T>[] | undefined;
              renderItem: (info: ListRenderItemInfo<T>) => ReactNode;
              autoexpand?: boolean | undefined;
              renderHeader?: ((info: { section: S }) => ReactNode) | null | undefined;
              model?: never;
          })
        | {
              model: Gio.ListModel;
              renderItem: (info: ListRenderItemInfo<UncontrolledItemType<T>>) => ReactNode;
              items?: never;
              sections?: never;
              autoexpand?: never;
              renderHeader?: never;
              selectedIds?: never;
              onSelectionChanged?: never;
              selectionMode?: never;
          }
    );

export type ListViewProps<T = unknown, S = unknown> = Omit<GtkListViewProps, keyof ListViewDeclarativeProps<T, S>> &
    ListViewDeclarativeProps<T, S>;

interface ListViewWiring<T, S> {
    setRef: (value: Gtk.ListView | null) => void;
    resolver: ItemResolver<T, S>;
    headerResolver: ItemResolver<T, S>;
    itemStore: CellContainerStore;
    headerStore: CellContainerStore;
    useHeader: boolean;
}

const useListViewWiring = <T, S>(props: NormalizedListViewProps<T, S>): ListViewWiring<T, S> => {
    const widgetRef = useRef<Gtk.ListView | null>(null);
    const setRef = useMergeRefs<Gtk.ListView>(props.ref, widgetRef);

    const externalModel = props.model as Gio.ListModel | undefined;
    const listModel = useListModel<T, S>(
        externalModel === undefined
            ? { items: props.items, sections: props.sections, autoexpand: props.autoexpand }
            : { model: externalModel },
    );

    const installedModel = useControlledSelectionModel<T, S>(externalModel, {
        base: listModel.model,
        resolver: listModel.resolver,
        selectionMode: props.selectionMode,
        selectedIds: props.selectedIds,
        onSelectionChanged: props.onSelectionChanged,
    });

    const useHeader = externalModel === undefined && typeof props.renderHeader === "function";

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

    useInstalledModel(widgetRef, installedModel, (widget, value) => widget.setModel(value));

    return {
        setRef,
        resolver: listModel.resolver,
        headerResolver: listModel.headerResolver,
        itemStore,
        headerStore,
        useHeader,
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
    } = props as NormalizedListViewProps<T, S>;

    const renderItemFn = renderItem as (info: ListRenderItemInfo<T>) => ReactNode;
    const cellRenderer: CellRenderer<T, S> = (value, treeRow, position) =>
        renderItemFn({
            item: value as T,
            index: position,
            depth: treeRow === null ? 0 : treeRow.getDepth(),
            isExpanded: treeRow === null ? false : treeRow.getExpanded(),
        });

    const wiring = useListViewWiring<T, S>({
        ref,
        items,
        sections,
        model,
        autoexpand,
        renderHeader,
        selectedIds,
        selectionMode,
        onSelectionChanged,
        estimatedItemHeight,
        estimatedItemWidth,
    } as NormalizedListViewProps<T, S>);

    const intrinsic: ReactElement = createElement(GtkListView, { ...intrinsicProps, ref: wiring.setRef });

    return (
        <>
            {intrinsic}
            <CellRenderHost store={wiring.itemStore} resolver={wiring.resolver} render={cellRenderer} />
            {wiring.useHeader ? (
                <CellRenderHost
                    store={wiring.headerStore}
                    resolver={wiring.headerResolver}
                    render={headerRenderer<T, S>(renderHeader)}
                />
            ) : null}
        </>
    );
};
