import type * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import { useForwardedRef } from "@gtkx/react";
import {
    createElement,
    type ElementType,
    type ReactElement,
    type ReactNode,
    type Ref,
    useCallback,
    useRef,
} from "react";
import { CellRenderHost } from "./cell-render-host.js";
import { type FactoryInstaller, useCellContainers } from "./hooks/use-cell-containers.js";
import { useInstalledModel } from "./hooks/use-installed-model.js";
import { useListModel } from "./hooks/use-list-model.js";
import { useSelectionModel } from "./hooks/use-selection-model.js";
import type { CellRenderer } from "./list-cell.js";
import type { ItemNode } from "./types.js";
import type { CellContainerStore } from "./utils/cell-container-store.js";
import type { ItemResolver } from "./utils/item-resolver.js";

export interface ModelInstaller<W extends Gtk.Widget> {
    install(widget: W, model: Gio.ListModel): void;
}

export interface CollectionViewProps<T, S, W extends Gtk.Widget> {
    element: ElementType;
    intrinsicProps: Record<string, unknown>;
    ref: Ref<W | null> | undefined;
    items: ItemNode<T, S>[] | undefined;
    model: Gio.ListModel | undefined;
    renderItem: CellRenderer<T, S>;
    autoexpand: boolean | undefined;
    renderHeader: ((value: S | undefined) => ReactNode) | undefined;
    estimatedHeight: number | undefined;
    estimatedWidth: number | undefined;
    selected: string[] | null | undefined;
    selectionMode: Gtk.SelectionMode | null | undefined;
    onSelectionChanged: ((ids: string[]) => void) | null | undefined;
    factoryInstaller: FactoryInstaller<W>;
    headerFactoryInstaller: FactoryInstaller<W> | undefined;
    modelInstaller: ModelInstaller<W>;
    children?: ReactNode;
}

const headerRenderer =
    <T, S>(renderHeader: ((value: S | undefined) => ReactNode) | undefined): CellRenderer<T, S> =>
    (value) =>
        renderHeader ? renderHeader(value as S | undefined) : null;

interface CollectionWiring<T, S, W extends Gtk.Widget> {
    setRef: (value: W | null) => void;
    resolver: ItemResolver<T, S>;
    headerResolver: ItemResolver<T, S>;
    itemStore: CellContainerStore;
    headerStore: CellContainerStore;
}

const useCollectionWiring = <T, S, W extends Gtk.Widget>(
    props: CollectionViewProps<T, S, W>,
): CollectionWiring<T, S, W> => {
    const widgetRef = useRef<W | null>(null);
    const captureWidget = useCallback((value: W | null) => {
        widgetRef.current = value;
    }, []);
    const [, setRef] = useForwardedRef<W>(props.ref, captureWidget);

    const externalModel = props.model;
    const listModel = useListModel<T, S>(
        externalModel === undefined ? { items: props.items, autoexpand: props.autoexpand } : { model: externalModel },
    );

    const controlledSelection = useSelectionModel<T, S>({
        base: listModel.model,
        selectionMode: props.selectionMode,
        selected: props.selected,
        onSelectionChanged: props.onSelectionChanged,
        resolver: listModel.resolver,
    });
    const installedModel: Gio.ListModel = externalModel === undefined ? controlledSelection : externalModel;

    const items = useCellContainers<W>({
        target: widgetRef,
        installer: props.factoryInstaller,
        estimatedHeight: props.estimatedHeight,
        estimatedWidth: props.estimatedWidth,
    });
    const headers = useCellContainers<W>({
        target: props.headerFactoryInstaller ? widgetRef : null,
        installer: props.headerFactoryInstaller ?? props.factoryInstaller,
        estimatedHeight: props.estimatedHeight,
        estimatedWidth: props.estimatedWidth,
    });

    useInstalledModel(widgetRef, installedModel, (widget, model) => props.modelInstaller.install(widget, model));

    return {
        setRef,
        resolver: listModel.resolver,
        headerResolver: listModel.headerResolver,
        itemStore: items.store,
        headerStore: headers.store,
    };
};

export const CollectionView = <T, S, W extends Gtk.Widget>(props: CollectionViewProps<T, S, W>): ReactNode => {
    const { setRef, resolver, headerResolver, itemStore, headerStore } = useCollectionWiring(props);
    const intrinsic: ReactElement = createElement(props.element, { ...props.intrinsicProps, ref: setRef });

    return (
        <>
            {intrinsic}
            <CellRenderHost store={itemStore} resolver={resolver} render={props.renderItem} />
            {props.headerFactoryInstaller ? (
                <CellRenderHost
                    store={headerStore}
                    resolver={headerResolver}
                    render={headerRenderer<T, S>(props.renderHeader)}
                />
            ) : null}
            {props.children}
        </>
    );
};
