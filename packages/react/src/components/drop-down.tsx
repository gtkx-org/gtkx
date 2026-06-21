import type * as Adw from "@gtkx/gi/adw";
import type * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import { createElement, type ReactElement, type ReactNode, type Ref, type RefObject, useRef, useState } from "react";
import { useDropDownSelection } from "../hooks/use-drop-down-selection.js";
import { useForwardedRef } from "../hooks/use-forwarded-ref.js";
import { useListModel } from "../hooks/use-list-model.js";
import { type FactoryBinding, useRealizedSlots } from "../hooks/use-realized-slots.js";
import { createElementComponent } from "../utils/create-element-component.js";
import type { DropDownProps, ListItem } from "../utils/element-props.js";
import type { ItemResolver } from "../utils/item-resolver.js";
import type { RealizedSlotStore } from "../utils/realized-slot-store.js";
import { useTargetRegistration } from "../utils/use-target-registration.js";
import { ListPortalHost } from "./list-portal-host.js";
import type { SlotRenderer } from "./list-slot.js";

interface LabelElementProps {
    label?: string | undefined;
}

const GtkLabelElement = createElementComponent<LabelElementProps>("GtkLabel");

/**
 * The widget surface shared by `Gtk.DropDown` and `Adw.ComboRow` used by the shared implementation.
 */
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

const defaultRenderer: SlotRenderer<unknown, unknown> = (value) => {
    if (value === undefined || value === null) return null;
    return createElement(GtkLabelElement, { label: String(value) });
};

const useModelInstallation = (target: RefObject<DropDownWidget | null>, model: Gio.ListModel): void => {
    useTargetRegistration<DropDownWidget, { widget: DropDownWidget; model: Gio.ListModel }>(target, {
        attach: (widget) => {
            widget.setModel(model);
            return { widget, model };
        },
        detach: () => {},
        isSame: (registration, widget) => registration.widget === widget && registration.model === model,
    });
};

interface DropDownImplProps<T, S, W extends DropDownWidget> {
    element: string;
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
    return (value) => renderItem(value as T);
};

const toPopupRenderer = <T, S>(
    renderListItem: ((value: T) => ReactNode) | null | undefined,
    renderItem: ((value: T) => ReactNode) | null | undefined,
): SlotRenderer<T, S> => {
    if (typeof renderListItem === "function") return (value) => renderListItem(value as T);
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
    faceStore: RealizedSlotStore;
    popupStore: RealizedSlotStore;
    headerStore: RealizedSlotStore;
    useHeader: boolean;
}

const createFaceResolver = <T, S>(resolver: ItemResolver<T, S>, selectedPosition: number): ItemResolver<T, S> => ({
    count: resolver.count,
    positionOf: (id) => resolver.positionOf(id),
    idOf: (position) => resolver.idOf(position),
    resolve: (_position, treeRow) => resolver.resolve(selectedPosition, treeRow),
});

const useDropDownWiring = <T, S, W extends DropDownWidget>(
    props: DropDownImplProps<T, S, W>,
): DropDownWiring<T, S, W> => {
    const widgetRef = useRef<DropDownWidget | null>(null);
    const [widget, setWidget] = useState<DropDownWidget | null>(null);
    const [, setRef] = useForwardedRef<W>(props.ref, (value: W | null) => {
        widgetRef.current = value;
        setWidget(value);
    });

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

    useModelInstallation(widgetRef, listModel.model);

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
        faceStore: face.store,
        popupStore: popup.store,
        headerStore: header.store,
        useHeader,
    };
};

const DropDownImpl = <T, S, W extends DropDownWidget>(props: DropDownImplProps<T, S, W>): ReactNode => {
    const { setRef, resolver, faceResolver, faceStore, popupStore, headerStore, useHeader } = useDropDownWiring(props);
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
                    resolver={resolver}
                    render={toHeaderRenderer<T, S>(props.renderHeader)}
                />
            ) : null}
        </>
    );
};

const DROP_DOWN_ELEMENT = "GtkDropDown";
const COMBO_ROW_ELEMENT = "AdwComboRow";

type DropDownComponentProps<T, S, W extends DropDownWidget> = DropDownProps<T, S> & {
    ref?: Ref<W | null> | undefined;
};

const extractDropDownProps = <T, S, W extends DropDownWidget>(
    props: DropDownComponentProps<T, S, W>,
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
 * A `Gtk.DropDown` driven by a controlled `items` array or an external `Gio.ListModel`.
 *
 * The button face renders the currently selected value through `renderItem`, while the popup list
 * renders every position through `renderListItem` (falling back to `renderItem`); when neither is
 * supplied each value renders as a label by default. Controlled `selectedId` selects by item id and
 * `onSelectionChanged(id)` reports the selected id as a single string. When `renderHeader` is
 * provided over sectioned items a header factory renders the section headers. The position-only or
 * external model is installed directly because the widget owns its own single selection. The ref is
 * forwarded to the underlying `Gtk.DropDown`.
 *
 * @typeParam T - The value type of regular items.
 * @typeParam S - The value type of section headers.
 * @param props - The drop-down configuration plus any underlying `Gtk.DropDown` props.
 * @returns The rendered drop-down.
 */
export const GtkDropDown = <T = unknown, S = unknown>(props: DropDownComponentProps<T, S, Gtk.DropDown>): ReactNode => {
    const { impl, intrinsicProps } = extractDropDownProps<T, S, Gtk.DropDown>(props);
    return <DropDownImpl<T, S, Gtk.DropDown> element={DROP_DOWN_ELEMENT} intrinsicProps={intrinsicProps} {...impl} />;
};

/**
 * An `Adw.ComboRow` driven by a controlled `items` array or an external `Gio.ListModel`.
 *
 * `AdwComboRow` shares the drop-down behavior: the collapsed row face renders the selected value
 * through `renderItem` and the popup list renders every position through `renderListItem` (falling
 * back to `renderItem`), defaulting to a label per value. Controlled `selectedId` selects by id and
 * `onSelectionChanged(id)` reports the selected id. The `title` and other `Adw.ComboRow` props pass
 * through to the underlying widget, to which the ref is forwarded.
 *
 * @typeParam T - The value type of regular items.
 * @typeParam S - The value type of section headers.
 * @param props - The drop-down configuration plus any underlying `Adw.ComboRow` props.
 * @returns The rendered combo row.
 */
export const AdwComboRow = <T = unknown, S = unknown>(props: DropDownComponentProps<T, S, Adw.ComboRow>): ReactNode => {
    const { impl, intrinsicProps } = extractDropDownProps<T, S, Adw.ComboRow>(props);
    return <DropDownImpl<T, S, Adw.ComboRow> element={COMBO_ROW_ELEMENT} intrinsicProps={intrinsicProps} {...impl} />;
};
