import type * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkColumnView, type GtkColumnViewProps } from "@gtkx/jsx/gtk";
import { useMergeRefs } from "@gtkx/react";
import { createElement, type ReactNode, type Ref, useCallback, useMemo, useRef, useState } from "react";
import { CellRenderHost, headerRenderer } from "./cell.js";
import { ColumnViewColumn } from "./column-view-column.js";
import { type ColumnRegistration, ColumnViewContext, type ColumnViewContextValue } from "./column-view-context.js";
import { type FactoryInstaller, useCellContainers } from "./hooks/use-cell-containers.js";
import { useCollectionModel } from "./hooks/use-collection-model.js";
import { useInstalledModel } from "./hooks/use-installed-model.js";
import { useSortHandler } from "./hooks/use-sort-handler.js";
import type { CollectionItemSizeProps, ControlledSelectionProps, ItemNode, SectionNode } from "./types.js";
import type { CellContainerStore } from "./utils/cell-container-store.js";
import type { ItemResolver } from "./utils/item-resolver.js";

const headerFactoryInstaller: FactoryInstaller<Gtk.ColumnView> = {
    install: (widget, factory) => widget.setHeaderFactory(factory),
    uninstall: (widget) => widget.setHeaderFactory(null),
};

interface ColumnRegistry {
    columns: ColumnRegistration[];
    register(registration: ColumnRegistration): void;
    unregister(id: string): void;
}

const useColumnRegistry = (): ColumnRegistry => {
    const [registrations, setRegistrations] = useState<Map<string, ColumnRegistration>>(() => new Map());
    const register = useCallback((registration: ColumnRegistration): void => {
        setRegistrations((current) => {
            const next = new Map(current);
            next.set(registration.id, registration);
            return next;
        });
    }, []);
    const unregister = useCallback((id: string): void => {
        setRegistrations((current) => {
            if (!current.has(id)) return current;
            const next = new Map(current);
            next.delete(id);
            return next;
        });
    }, []);
    const columns = useMemo(() => [...registrations.values()], [registrations]);
    return { columns, register, unregister };
};

type ColumnViewSortProps = {
    sortColumn?: string | null | undefined;
    sortOrder?: Gtk.SortType | null | undefined;
    onSortChanged?: ((column: string | null, order: Gtk.SortType) => void) | null | undefined;
};

type ColumnViewDeclarativeProps<T = unknown, S = unknown> = ColumnViewSortProps &
    CollectionItemSizeProps &
    (
        | (ControlledSelectionProps & {
              items?: ItemNode<T>[] | undefined;
              sections?: SectionNode<S, T>[] | undefined;
              renderHeader?: ((info: { section: S }) => ReactNode) | null | undefined;
              model?: never;
          })
        | {
              model: Gio.ListModel;
              items?: never;
              sections?: never;
              renderHeader?: never;
              selectedIds?: never;
              onSelectionChanged?: never;
              selectionMode?: never;
          }
    );

export type ColumnViewProps<T = unknown, S = unknown> = Omit<
    GtkColumnViewProps,
    "columns" | keyof ColumnViewDeclarativeProps<T, S>
> &
    ColumnViewDeclarativeProps<T, S>;

type NormalizedColumnViewProps<T, S> = ColumnViewDeclarativeProps<T, S> & {
    ref?: Ref<Gtk.ColumnView | null>;
    renderHeader?: ((info: { section: S }) => ReactNode) | null;
    children?: ReactNode;
    [key: string]: unknown;
};

interface ColumnViewWiring<T, S> {
    setRef: (value: Gtk.ColumnView | null) => void;
    resolver: ItemResolver<T, S>;
    headerResolver: ItemResolver<T, S>;
    headerStore: CellContainerStore;
    useHeader: boolean;
    contextValue: ColumnViewContextValue;
}

const useColumnViewWiring = <T, S>(
    props: NormalizedColumnViewProps<T, S>,
    registry: ColumnRegistry,
): ColumnViewWiring<T, S> => {
    const widgetRef = useRef<Gtk.ColumnView | null>(null);
    const setRef = useMergeRefs<Gtk.ColumnView>(props.ref, widgetRef);

    const collection = useCollectionModel<T, S>({
        model: props.model as Gio.ListModel | undefined,
        items: props.items,
        sections: props.sections,
        selectionMode: props.selectionMode,
        selectedIds: props.selectedIds,
        onSelectionChanged: props.onSelectionChanged,
        renderHeader: props.renderHeader,
    });
    useInstalledModel(widgetRef, collection.installedModel, (widget, model) => widget.setModel(model));

    const useHeader = collection.useHeader;
    const headerStore = useCellContainers<Gtk.ColumnView>({
        target: useHeader ? widgetRef : null,
        installer: headerFactoryInstaller,
        estimatedHeight: props.estimatedItemHeight,
    });

    useSortHandler({
        columnView: widgetRef,
        sortColumn: props.sortColumn,
        sortOrder: props.sortOrder,
        onSortChanged: props.onSortChanged,
        columns: registry.columns,
    });

    const contextValue = useMemo<ColumnViewContextValue>(
        () => ({
            columnView: widgetRef,
            resolver: collection.resolver as ItemResolver<unknown, unknown>,
            register: registry.register,
            unregister: registry.unregister,
        }),
        [collection.resolver, registry.register, registry.unregister],
    );

    return {
        setRef,
        resolver: collection.resolver,
        headerResolver: collection.headerResolver,
        headerStore,
        useHeader,
        contextValue,
    };
};

const ColumnViewComponent = <T = unknown, S = unknown>(props: ColumnViewProps<T, S>): ReactNode => {
    const {
        ref,
        items,
        sections,
        model,
        selectedIds,
        selectionMode,
        onSelectionChanged,
        sortColumn,
        sortOrder,
        onSortChanged,
        renderHeader,
        estimatedItemHeight,
        estimatedItemWidth,
        children,
        ...intrinsicProps
    } = props as NormalizedColumnViewProps<T, S>;

    const registry = useColumnRegistry();
    const wiring = useColumnViewWiring<T, S>(
        {
            ref,
            items,
            sections,
            model,
            selectedIds,
            selectionMode,
            onSelectionChanged,
            sortColumn,
            sortOrder,
            onSortChanged,
            renderHeader,
            estimatedItemHeight,
            estimatedItemWidth,
        } as NormalizedColumnViewProps<T, S>,
        registry,
    );

    const intrinsic = createElement(
        GtkColumnView,
        { ...intrinsicProps, ref: wiring.setRef },
        <ColumnViewContext.Provider value={wiring.contextValue}>{children}</ColumnViewContext.Provider>,
    );

    return (
        <>
            {intrinsic}
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

export const ColumnView: typeof ColumnViewComponent & {
    Column: typeof ColumnViewColumn;
} = Object.assign(ColumnViewComponent, { Column: ColumnViewColumn });
