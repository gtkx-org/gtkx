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
import { useListModel } from "./hooks/use-list-model.js";
import { useModelInstallation } from "./hooks/use-model-installation.js";
import { type FactoryBinding, useRealizedSlots } from "./hooks/use-realized-slots.js";
import { useSelectionModel } from "./hooks/use-selection-model.js";
import { ListPortalHost } from "./list-portal-host.js";
import type { SlotRenderer } from "./list-slot.js";
import type { ListItem } from "./types.js";
import type { ItemResolver } from "./utils/item-resolver.js";
import type { RealizedSlotStore } from "./utils/realized-slot-store.js";

export interface ModelBinding<W extends Gtk.Widget> {
    install(widget: W, model: Gio.ListModel): void;
}

export interface CollectionViewProps<T, S, W extends Gtk.Widget> {
    element: ElementType;
    intrinsicProps: Record<string, unknown>;
    ref: Ref<W | null> | undefined;
    items: ListItem<T, S>[] | undefined;
    model: Gio.ListModel | undefined;
    renderItem: SlotRenderer<T, S>;
    autoexpand: boolean | undefined;
    renderHeader: ((value: S | undefined) => ReactNode) | undefined;
    estimatedHeight: number | undefined;
    estimatedWidth: number | undefined;
    selected: string[] | null | undefined;
    selectionMode: Gtk.SelectionMode | null | undefined;
    onSelectionChanged: ((ids: string[]) => void) | null | undefined;
    factoryBinding: FactoryBinding<W>;
    headerFactoryBinding: FactoryBinding<W> | undefined;
    modelBinding: ModelBinding<W>;
    children?: ReactNode;
}

const headerRenderer =
    <T, S>(renderHeader: ((value: S | undefined) => ReactNode) | undefined): SlotRenderer<T, S> =>
    (value) =>
        renderHeader ? renderHeader(value as S | undefined) : null;

interface CollectionWiring<T, S, W extends Gtk.Widget> {
    setRef: (value: W | null) => void;
    resolver: ItemResolver<T, S>;
    headerResolver: ItemResolver<T, S>;
    itemStore: RealizedSlotStore;
    headerStore: RealizedSlotStore;
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

    const items = useRealizedSlots<W>({
        target: widgetRef,
        binding: props.factoryBinding,
        estimatedHeight: props.estimatedHeight,
        estimatedWidth: props.estimatedWidth,
    });
    const headers = useRealizedSlots<W>({
        target: props.headerFactoryBinding ? widgetRef : null,
        binding: props.headerFactoryBinding ?? props.factoryBinding,
        estimatedHeight: props.estimatedHeight,
        estimatedWidth: props.estimatedWidth,
    });

    useModelInstallation(widgetRef, installedModel, (widget, model) => props.modelBinding.install(widget, model));

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
            <ListPortalHost store={itemStore} resolver={resolver} render={props.renderItem} />
            {props.headerFactoryBinding ? (
                <ListPortalHost
                    store={headerStore}
                    resolver={headerResolver}
                    render={headerRenderer<T, S>(props.renderHeader)}
                />
            ) : null}
            {props.children}
        </>
    );
};
