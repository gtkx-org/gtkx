import type * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkDropDown, type GtkDropDownProps, GtkLabel } from "@gtkx/jsx/gtk";
import { useMergeRefs } from "@gtkx/react";
import { type ElementType, type ReactNode, type Ref, useCallback, useRef, useState } from "react";
import { type CellRenderer, CellRenderHost, HeaderRenderHost, itemRenderer } from "./cell.js";
import { type FactoryInstaller, useCellContainers } from "./hooks/use-cell-containers.js";
import { useDropDownSelection } from "./hooks/use-drop-down-selection.js";
import { useInstalledModel } from "./hooks/use-installed-model.js";
import { useListModel } from "./hooks/use-list-model.js";
import type { ItemNode, RenderItemProps, SectionNode } from "./types.js";
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

type DropDownItemRenderer<T> = (props: RenderItemProps<T>) => ReactNode;

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

const defaultRenderer: CellRenderer<unknown, unknown> = (value) => {
    if (value === undefined || value === null) return null;
    return <GtkLabel label={String(value)} />;
};

const toItemRenderer = <T, S>(renderItem: DropDownItemRenderer<T> | null | undefined): CellRenderer<T, S> => {
    if (typeof renderItem !== "function") return defaultRenderer as CellRenderer<T, S>;
    return itemRenderer<T, S>(renderItem);
};

const toListRenderer = <T, S>(
    renderListItem: DropDownItemRenderer<T> | null | undefined,
    renderItem: DropDownItemRenderer<T> | null | undefined,
): CellRenderer<T, S> => {
    if (typeof renderListItem === "function") return itemRenderer<T, S>(renderListItem);
    return toItemRenderer<T, S>(renderItem);
};

const createSelectionResolver = <T, S>(resolver: ItemResolver<T, S>, selectedPosition: number): ItemResolver<T, S> => ({
    positionOfId: (id) => resolver.positionOfId(id),
    idOf: (position) => resolver.idOf(position),
    resolve: (_position, treeRow) => resolver.resolve(selectedPosition, treeRow),
});

export type DropDownDeclarativeProps<T = unknown, S = unknown> = {
    items?: ItemNode<T>[] | undefined;
    sections?: SectionNode<S, T>[] | undefined;
    selectedId?: string | null | undefined;
    onSelectionChanged?: ((id: string) => void) | null | undefined;
    renderItem?: DropDownItemRenderer<T> | null | undefined;
    renderListItem?: DropDownItemRenderer<T> | null | undefined;
    renderHeader?: ((info: { section: S }) => ReactNode) | null | undefined;
};

export type DropDownProps<T = unknown, S = unknown> = Omit<
    GtkDropDownProps,
    keyof DropDownDeclarativeProps<T, S> | "model" | "factory" | "listFactory" | "headerFactory"
> &
    DropDownDeclarativeProps<T, S>;

interface DropDownBodyProps<T, S, W extends DropDownWidget> {
    element: ElementType;
    props: DropDownDeclarativeProps<T, S> & { ref?: Ref<W | null> | undefined };
}

interface NormalizedDropDownProps<T, S, W extends DropDownWidget> {
    ref: Ref<W | null> | undefined;
    items: ItemNode<T>[] | undefined;
    sections: SectionNode<S, T>[] | undefined;
    selectedId: string | null | undefined;
    onSelectionChanged: ((id: string) => void) | null | undefined;
    renderHeader: ((info: { section: S }) => ReactNode) | null | undefined;
}

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

const useDropDownWiring = <T, S, W extends DropDownWidget>(
    props: NormalizedDropDownProps<T, S, W>,
): DropDownWiring<T, S, W> => {
    const widgetRef = useRef<DropDownWidget | null>(null);
    const [widget, setWidget] = useState<DropDownWidget | null>(null);
    const captureWidget = useCallback((value: W | null) => {
        widgetRef.current = value;
        setWidget(value);
    }, []);
    const setRef = useMergeRefs<W>(props.ref, captureWidget);

    const listModel = useListModel<T, S>({ items: props.items, sections: props.sections });

    const useHeader = typeof props.renderHeader === "function";

    const selectionStore = useCellContainers<DropDownWidget>({ target: widgetRef, installer: itemFactoryInstaller });
    const listStore = useCellContainers<DropDownWidget>({ target: widgetRef, installer: listFactoryInstaller });
    const headerStore = useCellContainers<DropDownWidget>({
        target: useHeader ? widgetRef : null,
        installer: headerFactoryInstaller,
    });

    useInstalledModel(widgetRef, listModel.model, (target, value) => target.setModel(value));

    const selectedPosition = useDropDownSelection<T, S>({
        widget,
        resolver: listModel.resolver,
        selectedId: props.selectedId,
        onSelectionChanged: props.onSelectionChanged,
    });

    const controlledPosition =
        props.selectedId === undefined || props.selectedId === null
            ? -1
            : listModel.resolver.positionOfId(props.selectedId);
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

export const DropDownBody = <T, S, W extends DropDownWidget>({
    element,
    props,
}: DropDownBodyProps<T, S, W>): ReactNode => {
    const {
        ref,
        items,
        sections,
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

    const renderItemFn = renderItem as DropDownItemRenderer<T> | null | undefined;
    const renderListItemFn = renderListItem as DropDownItemRenderer<T> | null | undefined;
    const renderHeaderFn = renderHeader as ((info: { section: S }) => ReactNode) | null | undefined;

    const wiring = useDropDownWiring<T, S, W>({
        ref,
        items: items as ItemNode<T>[] | undefined,
        sections: sections as SectionNode<S, T>[] | undefined,
        selectedId: selectedId as string | null | undefined,
        onSelectionChanged: onSelectionChanged as ((id: string) => void) | null | undefined,
        renderHeader: renderHeaderFn,
    });

    const Element = element;

    return (
        <>
            <Element {...intrinsicProps} ref={wiring.setRef} />
            <CellRenderHost
                store={wiring.selectionStore}
                resolver={wiring.selectionResolver}
                render={toItemRenderer<T, S>(renderItemFn)}
            />
            <CellRenderHost
                store={wiring.listStore}
                resolver={wiring.resolver}
                render={toListRenderer<T, S>(renderListItemFn, renderItemFn)}
            />
            <HeaderRenderHost
                useHeader={wiring.useHeader}
                store={wiring.headerStore}
                resolver={wiring.headerResolver}
                renderHeader={renderHeaderFn}
            />
        </>
    );
};

export const DropDown = <T = unknown, S = unknown>(props: DropDownProps<T, S>): ReactNode => (
    <DropDownBody<T, S, Gtk.DropDown> element={GtkDropDown} props={props} />
);
