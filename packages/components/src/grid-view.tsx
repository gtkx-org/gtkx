import type * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkGridView, type GtkGridViewProps } from "@gtkx/jsx/gtk";
import { useMergeRefs } from "@gtkx/react";
import { createElement, type ReactElement, type ReactNode, type Ref, useRef } from "react";
import { type CellRenderer, CellRenderHost, itemRenderer } from "./cell.js";
import { type FactoryInstaller, useCellContainers } from "./hooks/use-cell-containers.js";
import { useControlledSelectionModel } from "./hooks/use-controlled-selection-model.js";
import { useInstalledModel } from "./hooks/use-installed-model.js";
import { useListModel } from "./hooks/use-list-model.js";
import type {
    CollectionItemSizeProps,
    ControlledSelectionProps,
    ItemNode,
    RenderItemInfo,
    UncontrolledItemType,
} from "./types.js";

const factoryInstaller: FactoryInstaller<Gtk.GridView> = {
    install: (widget: Gtk.GridView, factory: Gtk.SignalListItemFactory) => widget.setFactory(factory),
    uninstall: (widget: Gtk.GridView) => widget.setFactory(null),
};

export type GridRenderItemInfo<T> = RenderItemInfo<T>;

type GridViewDeclarativeProps<T = unknown> = CollectionItemSizeProps &
    (
        | (ControlledSelectionProps & {
              items?: ItemNode<T>[] | undefined;
              renderItem: (info: RenderItemInfo<T>) => ReactNode;
              model?: never;
          })
        | {
              model: Gio.ListModel;
              renderItem: (info: RenderItemInfo<UncontrolledItemType<T>>) => ReactNode;
              items?: never;
              selectedIds?: never;
              onSelectionChanged?: never;
              selectionMode?: never;
          }
    );

export type GridViewProps<T = unknown> = Omit<GtkGridViewProps, keyof GridViewDeclarativeProps<T>> &
    GridViewDeclarativeProps<T>;

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

    const renderItemFn = renderItem as (info: RenderItemInfo<T>) => ReactNode;
    const cellRenderer: CellRenderer<T, unknown> = itemRenderer<T, unknown>(renderItemFn);

    const widgetRef = useRef<Gtk.GridView | null>(null);
    const setRef = useMergeRefs<Gtk.GridView>(ref, widgetRef);

    const externalModel = model as Gio.ListModel | undefined;
    const listModel = useListModel<T, unknown>(externalModel === undefined ? { items } : { model: externalModel });

    const installedModel = useControlledSelectionModel<T, unknown>(externalModel, {
        base: listModel.model,
        resolver: listModel.resolver,
        selectionMode,
        selectedIds,
        onSelectionChanged,
    });

    const itemStore = useCellContainers<Gtk.GridView>({
        target: widgetRef,
        installer: factoryInstaller,
        estimatedHeight: estimatedItemHeight,
        estimatedWidth: estimatedItemWidth,
    });

    useInstalledModel(widgetRef, installedModel, (widget, value) => widget.setModel(value));

    const intrinsic: ReactElement = createElement(GtkGridView, { ...intrinsicProps, ref: setRef });

    return (
        <>
            {intrinsic}
            <CellRenderHost store={itemStore} resolver={listModel.resolver} render={cellRenderer} />
        </>
    );
};
