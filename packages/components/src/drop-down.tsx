import type * as Adw from "@gtkx/gi/adw";
import type * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import { AdwComboRow, type AdwComboRowProps } from "@gtkx/jsx/adw";
import { GtkDropDown, type GtkDropDownProps, GtkLabel } from "@gtkx/jsx/gtk";
import { useForwardedRef } from "@gtkx/react";
import {
    createElement,
    type ElementType,
    type ReactElement,
    type ReactNode,
    type Ref,
    useCallback,
    useRef,
    useState,
} from "react";
import { useDropDownSelection } from "./hooks/use-drop-down-selection.js";
import { useListModel } from "./hooks/use-list-model.js";
import { useModelInstallation } from "./hooks/use-model-installation.js";
import { type FactoryBinding, useRealizedSlots } from "./hooks/use-realized-slots.js";
import { ListPortalHost } from "./list-portal-host.js";
import type { SlotRenderer } from "./list-slot.js";
import type { DropDownProps, ListItem } from "./types.js";
import type { ItemResolver } from "./utils/item-resolver.js";
import type { RealizedSlotStore } from "./utils/realized-slot-store.js";

export interface DropDownWidget extends Gtk.Widget {
    getSelected(): number;
    setSelected(position: number): void;
    setModel(model: Gio.ListModel | null): void;
    setFactory(factory: Gtk.ListItemFactory | null): void;
    setListFactory(factory: Gtk.ListItemFactory | null): void;
    setHeaderFactory(factory: Gtk.ListItemFactory | null): void;
}

const itemFactoryBinding: FactoryBinding<DropDownWidget> = {
    install: (widget, factory) => widget.setFactory(factory),
    uninstall: (widget) => widget.setFactory(null),
};

const listFactoryBinding: FactoryBinding<DropDownWidget> = {
    install: (widget, factory) => widget.setListFactory(factory),
    uninstall: (widget) => widget.setListFactory(null),
};

const headerFactoryBinding: FactoryBinding<DropDownWidget> = {
    install: (widget, factory) => widget.setHeaderFactory(factory),
    uninstall: (widget) => widget.setHeaderFactory(null),
};

const defaultRenderer: SlotRenderer<unknown, unknown> = (value, _treeRow, isHeader) => {
    if (isHeader || value === undefined || value === null) return null;
    return createElement(GtkLabel, { label: String(value) });
};

interface DropDownImplProps<T, S, W extends DropDownWidget> {
    element: ElementType;
    intrinsicProps: Record<string, unknown>;
    ref: Ref<W | null> | undefined;
    items: ListItem<T, S>[] | undefined;
    model: Gio.ListModel | undefined;
    renderItem: ((value: T) => ReactNode) | null | undefined;
    renderListItem: ((value: T) => ReactNode) | null | undefined;
    renderHeader: ((value: S) => ReactNode) | null | undefined;
    selectedId: string | null | undefined;
    onSelectionChanged: ((id: string) => void) | null | undefined;
}

const toItemRenderer = <T, S>(renderItem: ((value: T) => ReactNode) | null | undefined): SlotRenderer<T, S> => {
    if (typeof renderItem !== "function") return defaultRenderer as SlotRenderer<T, S>;
    return (value, _treeRow, isHeader) => (isHeader ? null : renderItem(value as T));
};

const toPopupRenderer = <T, S>(
    renderListItem: ((value: T) => ReactNode) | null | undefined,
    renderItem: ((value: T) => ReactNode) | null | undefined,
): SlotRenderer<T, S> => {
    if (typeof renderListItem === "function")
        return (value, _treeRow, isHeader) => (isHeader ? null : renderListItem(value as T));
    return toItemRenderer<T, S>(renderItem);
};

const toHeaderRenderer = <T, S>(renderHeader: ((value: S) => ReactNode) | null | undefined): SlotRenderer<T, S> => {
    if (typeof renderHeader !== "function") return () => null;
    return (value) => renderHeader(value as S);
};

interface DropDownWiring<T, S, W extends DropDownWidget> {
    setRef: (value: W | null) => void;
    resolver: ItemResolver<T, S>;
    faceResolver: ItemResolver<T, S>;
    headerResolver: ItemResolver<T, S>;
    faceStore: RealizedSlotStore;
    popupStore: RealizedSlotStore;
    headerStore: RealizedSlotStore;
    useHeader: boolean;
}

const createFaceResolver = <T, S>(resolver: ItemResolver<T, S>, selectedPosition: number): ItemResolver<T, S> => ({
    count: resolver.count,
    positionOf: (id) => resolver.positionOf(id),
    idOf: (position) => resolver.idOf(position),
    resolve: (_position, treeRow) => resolver.resolve(selectedPosition, treeRow, null),
});

const useDropDownWiring = <T, S, W extends DropDownWidget>(
    props: DropDownImplProps<T, S, W>,
): DropDownWiring<T, S, W> => {
    const widgetRef = useRef<DropDownWidget | null>(null);
    const [widget, setWidget] = useState<DropDownWidget | null>(null);
    const captureWidget = useCallback((value: W | null) => {
        widgetRef.current = value;
        setWidget(value);
    }, []);
    const [, setRef] = useForwardedRef<W>(props.ref, captureWidget);

    const externalModel = props.model;
    const listModel = useListModel<T, S>(
        externalModel === undefined ? { items: props.items ?? undefined } : { model: externalModel },
    );

    const useHeader = externalModel === undefined && typeof props.renderHeader === "function";

    const face = useRealizedSlots<DropDownWidget>({ target: widgetRef, binding: itemFactoryBinding });
    const popup = useRealizedSlots<DropDownWidget>({ target: widgetRef, binding: listFactoryBinding });
    const header = useRealizedSlots<DropDownWidget>({
        target: useHeader ? widgetRef : null,
        binding: headerFactoryBinding,
    });

    useModelInstallation(widgetRef, listModel.model, (widget, model) => widget.setModel(model));

    const selectedPosition = useDropDownSelection<T, S>({
        widget,
        resolver: listModel.resolver,
        selectedId: props.selectedId,
        onSelectionChanged: props.onSelectionChanged,
    });

    const controlledPosition =
        props.selectedId === undefined || props.selectedId === null
            ? -1
            : listModel.resolver.positionOf(props.selectedId);
    const facePosition = controlledPosition >= 0 ? controlledPosition : selectedPosition < 0 ? 0 : selectedPosition;

    return {
        setRef,
        resolver: listModel.resolver,
        faceResolver: createFaceResolver(listModel.resolver, facePosition),
        headerResolver: listModel.headerResolver,
        faceStore: face.store,
        popupStore: popup.store,
        headerStore: header.store,
        useHeader,
    };
};

const DropDownImpl = <T, S, W extends DropDownWidget>(props: DropDownImplProps<T, S, W>): ReactNode => {
    const { setRef, resolver, faceResolver, headerResolver, faceStore, popupStore, headerStore, useHeader } =
        useDropDownWiring(props);
    const intrinsic: ReactElement = createElement(props.element, { ...props.intrinsicProps, ref: setRef });

    return (
        <>
            {intrinsic}
            <ListPortalHost store={faceStore} resolver={faceResolver} render={toItemRenderer<T, S>(props.renderItem)} />
            <ListPortalHost
                store={popupStore}
                resolver={resolver}
                render={toPopupRenderer<T, S>(props.renderListItem, props.renderItem)}
            />
            {useHeader ? (
                <ListPortalHost
                    store={headerStore}
                    resolver={headerResolver}
                    render={toHeaderRenderer<T, S>(props.renderHeader)}
                />
            ) : null}
        </>
    );
};

type DropDownImplComponentProps<T, S, W extends DropDownWidget> = DropDownProps<T, S> & {
    ref?: Ref<W | null> | undefined;
};

const extractDropDownProps = <T, S, W extends DropDownWidget>(
    props: DropDownImplComponentProps<T, S, W>,
): {
    impl: Omit<DropDownImplProps<T, S, W>, "element" | "intrinsicProps">;
    intrinsicProps: Record<string, unknown>;
} => {
    const {
        ref,
        items,
        model,
        renderItem,
        renderListItem,
        renderHeader,
        selectedId,
        onSelectionChanged,
        ...intrinsicProps
    } = props as DropDownProps<T, S> & {
        ref?: Ref<W | null>;
        [key: string]: unknown;
    };

    return {
        impl: {
            ref,
            items: items as ListItem<T, S>[] | undefined,
            model: model as Gio.ListModel | undefined,
            renderItem: renderItem as ((value: T) => ReactNode) | null | undefined,
            renderListItem: renderListItem as ((value: T) => ReactNode) | null | undefined,
            renderHeader: renderHeader as ((value: S) => ReactNode) | null | undefined,
            selectedId: selectedId as string | null | undefined,
            onSelectionChanged: onSelectionChanged as ((id: string) => void) | null | undefined,
        },
        intrinsicProps: intrinsicProps as Record<string, unknown>,
    };
};

/**
 * Props for the {@link DropDown} component: the raw `GtkDropDown` element
 * surface with its factory/model wiring replaced by the declarative
 * {@link DropDownProps} API.
 */
export type DropDownComponentProps<T = unknown, S = unknown> = Omit<GtkDropDownProps, keyof DropDownProps<T, S>> &
    DropDownProps<T, S>;

/**
 * Props for the {@link ComboRow} component: the raw `AdwComboRow` element
 * surface with its factory/model wiring replaced by the declarative
 * {@link DropDownProps} API.
 */
export type ComboRowComponentProps<T = unknown, S = unknown> = Omit<AdwComboRowProps, keyof DropDownProps<T, S>> &
    DropDownProps<T, S>;

/**
 * A `GtkDropDown` driven by a declarative `items` model with a controlled
 * `selectedId` and per-slot renderers for the selected face, the popup list,
 * and section headers. Supplying an external `model` switches to the
 * uncontrolled form.
 */
export const DropDown = <T = unknown, S = unknown>(props: DropDownComponentProps<T, S>): ReactNode => {
    const { impl, intrinsicProps } = extractDropDownProps<T, S, Gtk.DropDown>(props);
    return <DropDownImpl<T, S, Gtk.DropDown> element={GtkDropDown} intrinsicProps={intrinsicProps} {...impl} />;
};

/**
 * An `AdwComboRow` driven by a declarative `items` model with a controlled
 * `selectedId` and per-slot renderers for the selected face, the popup list,
 * and section headers. Supplying an external `model` switches to the
 * uncontrolled form.
 */
export const ComboRow = <T = unknown, S = unknown>(props: ComboRowComponentProps<T, S>): ReactNode => {
    const { impl, intrinsicProps } = extractDropDownProps<T, S, Adw.ComboRow>(props);
    return <DropDownImpl<T, S, Adw.ComboRow> element={AdwComboRow} intrinsicProps={intrinsicProps} {...impl} />;
};
