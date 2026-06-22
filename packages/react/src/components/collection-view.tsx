import type * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import { createElement, type ReactElement, type ReactNode, type Ref, type RefObject, useCallback, useRef } from "react";
import { useForwardedRef } from "../hooks/use-forwarded-ref.js";
import { useListModel } from "../hooks/use-list-model.js";
import { type FactoryBinding, useRealizedSlots } from "../hooks/use-realized-slots.js";
import { useSelectionModel } from "../hooks/use-selection-model.js";
import type { ListItem } from "../utils/element-props.js";
import type { ItemResolver } from "../utils/item-resolver.js";
import type { RealizedSlotStore } from "../utils/realized-slot-store.js";
import { useTargetRegistration } from "../utils/use-target-registration.js";
import { ListPortalHost } from "./list-portal-host.js";
import type { SlotRenderer } from "./list-slot.js";

/**
 * Installs a model on a concrete view widget.
 *
 * @typeParam W - The widget type whose model is managed.
 */
export interface ModelBinding<W extends Gtk.Widget> {
    install(widget: W, model: Gio.ListModel): void;
}

const useModelInstallation = <W extends Gtk.Widget>(
    target: RefObject<W | null>,
    binding: ModelBinding<W>,
    model: Gio.ListModel,
): void => {
    const bindingRef = useRef(binding);
    bindingRef.current = binding;
    useTargetRegistration<W, { widget: W; model: Gio.ListModel }>(target, {
        attach: (widget) => {
            bindingRef.current.install(widget, model);
            return { widget, model };
        },
        detach: () => {},
        isSame: (registration, widget) => registration.widget === widget && registration.model === model,
    });
};

/**
 * Configuration for {@link CollectionView}.
 *
 * @typeParam T - The value type of regular items.
 * @typeParam S - The value type of section headers.
 * @typeParam W - The underlying GTK view widget type.
 */
export interface CollectionViewProps<T, S, W extends Gtk.Widget> {
    element: string;
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

    useModelInstallation(widgetRef, props.modelBinding, installedModel);

    return { setRef, resolver: listModel.resolver, itemStore: items.store, headerStore: headers.store };
};

/**
 * The shared implementation behind `GtkListView`, `GtkGridView`, and `GtkColumnView`.
 *
 * It forwards a ref to the underlying GTK view widget, builds the position-only model and value
 * resolver through {@link useListModel}, wraps that model in a live selection model (controlled
 * mode) or installs the user-supplied selection model directly (uncontrolled mode), installs the
 * realization factory, and renders the realized portals through {@link ListPortalHost}. When a
 * header factory binding is supplied and the items declare sections, a second factory drives the
 * section-header portals.
 *
 * @typeParam T - The value type of regular items.
 * @typeParam S - The value type of section headers.
 * @typeParam W - The underlying GTK view widget type.
 * @param props - The element name, intrinsic props, data, renderers, selection, and bindings.
 * @returns The intrinsic element together with the realized item and header portals.
 */
export const CollectionView = <T, S, W extends Gtk.Widget>(props: CollectionViewProps<T, S, W>): ReactNode => {
    const { setRef, resolver, itemStore, headerStore } = useCollectionWiring(props);
    const intrinsic: ReactElement = createElement(props.element, { ...props.intrinsicProps, ref: setRef });

    return (
        <>
            {intrinsic}
            <ListPortalHost store={itemStore} resolver={resolver} render={props.renderItem} />
            {props.headerFactoryBinding ? (
                <ListPortalHost
                    store={headerStore}
                    resolver={resolver}
                    render={headerRenderer<T, S>(props.renderHeader)}
                />
            ) : null}
            {props.children}
        </>
    );
};
