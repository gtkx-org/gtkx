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
import { type CellRenderer, CellRenderHost } from "./cell.js";
import { type FactoryInstaller, useCellContainers } from "./hooks/use-cell-containers.js";
import { useDropDownSelection } from "./hooks/use-drop-down-selection.js";
import { useInstalledModel } from "./hooks/use-installed-model.js";
import { useListModel } from "./hooks/use-list-model.js";
import type { ItemNode, UncontrolledItemType } from "./types.js";
import type { CellContainerStore } from "./utils/cell-container-store.js";
import type { ItemResolver } from "./utils/item-resolver.js";

interface DropDownWidget extends Gtk.Widget {
    getSelected(): number;
    setSelected(position: number): void;
    setModel(model: Gio.ListModel | null): void;
    setFactory(factory: Gtk.ListItemFactory | null): void;
    setListFactory(factory: Gtk.ListItemFactory | null): void;
    setHeaderFactory(factory: Gtk.ListItemFactory | null): void;
}

const itemFactoryInstaller: FactoryInstaller<DropDownWidget> = {
    install: (widget, factory) => widget.setFactory(factory),
    uninstall: (widget) => widget.setFactory(null),
};

const listFactoryInstaller: FactoryInstaller<DropDownWidget> = {
    install: (widget, factory) => widget.setListFactory(factory),
    uninstall: (widget) => widget.setListFactory(null),
};

const headerFactoryInstaller: FactoryInstaller<DropDownWidget> = {
    install: (widget, factory) => widget.setHeaderFactory(factory),
    uninstall: (widget) => widget.setHeaderFactory(null),
};

const defaultRenderer: CellRenderer<unknown, unknown> = (value, _treeRow, isHeader) => {
    if (isHeader || value === undefined || value === null) return null;
    return createElement(GtkLabel, { label: String(value) });
};

interface DropDownViewProps<T, S, W extends DropDownWidget> {
    element: ElementType;
    intrinsicProps: Record<string, unknown>;
    ref: Ref<W | null> | undefined;
    items: ItemNode<T, S>[] | undefined;
    model: Gio.ListModel | undefined;
    renderItem: ((value: T) => ReactNode) | null | undefined;
    renderListItem: ((value: T) => ReactNode) | null | undefined;
    renderHeader: ((value: S) => ReactNode) | null | undefined;
    selectedId: string | null | undefined;
    onSelectionChanged: ((id: string) => void) | null | undefined;
}

const toItemRenderer = <T, S>(renderItem: ((value: T) => ReactNode) | null | undefined): CellRenderer<T, S> => {
    if (typeof renderItem !== "function") return defaultRenderer as CellRenderer<T, S>;
    return (value, _treeRow, isHeader) => (isHeader ? null : renderItem(value as T));
};

const toListRenderer = <T, S>(
    renderListItem: ((value: T) => ReactNode) | null | undefined,
    renderItem: ((value: T) => ReactNode) | null | undefined,
): CellRenderer<T, S> => {
    if (typeof renderListItem === "function")
        return (value, _treeRow, isHeader) => (isHeader ? null : renderListItem(value as T));
    return toItemRenderer<T, S>(renderItem);
};

const toHeaderRenderer = <T, S>(renderHeader: ((value: S) => ReactNode) | null | undefined): CellRenderer<T, S> => {
    if (typeof renderHeader !== "function") return () => null;
    return (value) => renderHeader(value as S);
};

interface DropDownWiring<T, S, W extends DropDownWidget> {
    setRef: (value: W | null) => void;
    resolver: ItemResolver<T, S>;
    selectionResolver: ItemResolver<T, S>;
    headerResolver: ItemResolver<T, S>;
    selectionStore: CellContainerStore;
    listStore: CellContainerStore;
    headerStore: CellContainerStore;
    useHeader: boolean;
}

const createSelectionResolver = <T, S>(resolver: ItemResolver<T, S>, selectedPosition: number): ItemResolver<T, S> => ({
    positionOfKey: (key) => resolver.positionOfKey(key),
    keyOf: (position) => resolver.keyOf(position),
    resolve: (_position, treeRow) => resolver.resolve(selectedPosition, treeRow, null),
});

const useDropDownWiring = <T, S, W extends DropDownWidget>(
    props: DropDownViewProps<T, S, W>,
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

    const selectionStore = useCellContainers<DropDownWidget>({ target: widgetRef, installer: itemFactoryInstaller });
    const listStore = useCellContainers<DropDownWidget>({ target: widgetRef, installer: listFactoryInstaller });
    const headerStore = useCellContainers<DropDownWidget>({
        target: useHeader ? widgetRef : null,
        installer: headerFactoryInstaller,
    });

    useInstalledModel(widgetRef, listModel.model, (widget, model) => widget.setModel(model));

    const selectedPosition = useDropDownSelection<T, S>({
        widget,
        resolver: listModel.resolver,
        selectedId: props.selectedId,
        onSelectionChanged: props.onSelectionChanged,
    });

    const controlledPosition =
        props.selectedId === undefined || props.selectedId === null
            ? -1
            : listModel.resolver.positionOfKey(props.selectedId);
    const selectionPosition =
        controlledPosition >= 0 ? controlledPosition : selectedPosition < 0 ? 0 : selectedPosition;

    return {
        setRef,
        resolver: listModel.resolver,
        selectionResolver: createSelectionResolver(listModel.resolver, selectionPosition),
        headerResolver: listModel.headerResolver,
        selectionStore,
        listStore,
        headerStore,
        useHeader,
    };
};

const DropDownView = <T, S, W extends DropDownWidget>(props: DropDownViewProps<T, S, W>): ReactNode => {
    const { setRef, resolver, selectionResolver, headerResolver, selectionStore, listStore, headerStore, useHeader } =
        useDropDownWiring(props);
    const intrinsic: ReactElement = createElement(props.element, { ...props.intrinsicProps, ref: setRef });

    return (
        <>
            {intrinsic}
            <CellRenderHost
                store={selectionStore}
                resolver={selectionResolver}
                render={toItemRenderer<T, S>(props.renderItem)}
            />
            <CellRenderHost
                store={listStore}
                resolver={resolver}
                render={toListRenderer<T, S>(props.renderListItem, props.renderItem)}
            />
            {useHeader ? (
                <CellRenderHost
                    store={headerStore}
                    resolver={headerResolver}
                    render={toHeaderRenderer<T, S>(props.renderHeader)}
                />
            ) : null}
        </>
    );
};

const extractDropDownProps = <T, S, W extends DropDownWidget>(
    props: DropDownDeclarativeProps<T, S> & { ref?: Ref<W | null> | undefined },
): {
    impl: Omit<DropDownViewProps<T, S, W>, "element" | "intrinsicProps">;
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
    } = props as DropDownDeclarativeProps<T, S> & {
        ref?: Ref<W | null>;
        [key: string]: unknown;
    };

    return {
        impl: {
            ref,
            items: items as ItemNode<T, S>[] | undefined,
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
 * Props shared by the {@link DropDown} and {@link ComboRow} components,
 * replacing the raw factory/model surface with declarative `items`, controlled
 * `selectedId`, and per-cell renderers for the current selection, the list
 * popup, and section headers. Supplying an external `model` switches to the
 * uncontrolled form.
 */
export type DropDownDeclarativeProps<T = unknown, S = unknown> =
    | {
          items?: ItemNode<T, S>[] | undefined;
          selectedId?: string | null | undefined;
          onSelectionChanged?: ((id: string) => void) | null | undefined;
          renderItem?: ((item: T) => ReactNode) | null | undefined;
          renderListItem?: ((item: T) => ReactNode) | null | undefined;
          renderHeader?: ((item: S) => ReactNode) | null | undefined;
          model?: never;
      }
    | {
          model: Gio.ListModel;
          renderItem?: ((item: UncontrolledItemType<T>) => ReactNode) | null | undefined;
          renderListItem?: ((item: UncontrolledItemType<T>) => ReactNode) | null | undefined;
          items?: never;
          selectedId?: never;
          onSelectionChanged?: never;
          renderHeader?: never;
      };

/**
 * Props for the {@link DropDown} component: the raw `GtkDropDown` element
 * surface with its factory/model wiring replaced by the declarative
 * {@link DropDownDeclarativeProps} API.
 */
export type DropDownProps<T = unknown, S = unknown> = Omit<GtkDropDownProps, keyof DropDownDeclarativeProps<T, S>> &
    DropDownDeclarativeProps<T, S>;

/**
 * Props for the {@link ComboRow} component: the raw `AdwComboRow` element
 * surface with its factory/model wiring replaced by the declarative
 * {@link DropDownDeclarativeProps} API.
 */
export type ComboRowProps<T = unknown, S = unknown> = Omit<AdwComboRowProps, keyof DropDownDeclarativeProps<T, S>> &
    DropDownDeclarativeProps<T, S>;

/**
 * A `GtkDropDown` driven by a declarative `items` model with a controlled
 * `selectedId` and per-cell renderers for the current selection, the list
 * popup, and section headers. Supplying an external `model` switches to the
 * uncontrolled form.
 */
export const DropDown = <T = unknown, S = unknown>(props: DropDownProps<T, S>): ReactNode => {
    const { impl, intrinsicProps } = extractDropDownProps<T, S, Gtk.DropDown>(props);
    return <DropDownView<T, S, Gtk.DropDown> element={GtkDropDown} intrinsicProps={intrinsicProps} {...impl} />;
};

/**
 * An `AdwComboRow` driven by a declarative `items` model with a controlled
 * `selectedId` and per-cell renderers for the current selection, the list
 * popup, and section headers. Supplying an external `model` switches to the
 * uncontrolled form.
 */
export const ComboRow = <T = unknown, S = unknown>(props: ComboRowProps<T, S>): ReactNode => {
    const { impl, intrinsicProps } = extractDropDownProps<T, S, Adw.ComboRow>(props);
    return <DropDownView<T, S, Adw.ComboRow> element={AdwComboRow} intrinsicProps={intrinsicProps} {...impl} />;
};
