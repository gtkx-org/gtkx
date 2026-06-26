import type * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkColumnView, type GtkColumnViewProps } from "@gtkx/jsx/gtk";
import { useMergeRefs } from "@gtkx/react";
import { createElement, type ReactNode, type Ref, useCallback, useMemo, useRef, useState } from "react";
import { CellRenderHost, headerRenderer } from "./cell.js";
import { type ColumnRegistration, ColumnViewContext, type ColumnViewContextValue } from "./column-view-context.js";
import { type FactoryInstaller, useCellContainers } from "./hooks/use-cell-containers.js";
import { useControlledSelectionModel } from "./hooks/use-controlled-selection-model.js";
import { useInstalledModel } from "./hooks/use-installed-model.js";
import { useListModel } from "./hooks/use-list-model.js";
import { useSortHandler } from "./hooks/use-sort-handler.js";
import type { ItemNode, ListViewControlledSelectionProps, SectionNode } from "./types.js";
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
    estimatedItemHeight?: number | null | undefined;
};

/**
 * Props for the {@link ColumnView} component, replacing the raw `GtkColumnView`
 * surface with a declarative `items`/`sections` model, optional controlled
 * selection, controlled sorting, and section headers. Columns are declared as
 * {@link ColumnViewColumn} children. Supplying an external `model` switches to
 * the uncontrolled form.
 */
type ColumnViewDeclarativeProps<T = unknown, S = unknown> = ColumnViewSortProps &
    (
        | (ListViewControlledSelectionProps & {
              items?: ItemNode<T>[] | undefined;
              sections?: SectionNode<S, T>[] | undefined;
              renderHeader?: ((item: S) => ReactNode) | null | undefined;
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

/**
 * Props for the {@link ColumnView} component: the raw `GtkColumnView` element
 * surface (minus its imperative `columns` property) with its model/sort wiring
 * replaced by the declarative {@link ColumnViewDeclarativeProps} API. Columns
 * are declared as {@link ColumnViewColumn} children.
 */
export type ColumnViewProps<T = unknown, S = unknown> = Omit<
    GtkColumnViewProps,
    "columns" | keyof ColumnViewDeclarativeProps<T, S>
> &
    ColumnViewDeclarativeProps<T, S>;

type NormalizedColumnViewProps<T, S> = ColumnViewDeclarativeProps<T, S> & {
    ref?: Ref<Gtk.ColumnView | null>;
    renderHeader?: ((value: S) => ReactNode) | null;
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

    const externalModel = props.model as Gio.ListModel | undefined;
    const listModel = useListModel<T, S>(
        externalModel === undefined ? { items: props.items, sections: props.sections } : { model: externalModel },
    );

    const installedModel = useControlledSelectionModel<T, S>(externalModel, {
        base: listModel.model,
        resolver: listModel.resolver,
        selectionMode: props.selectionMode,
        selectedIds: props.selectedIds,
        onSelectionChanged: props.onSelectionChanged,
    });
    useInstalledModel(widgetRef, installedModel, (widget, model) => widget.setModel(model));

    const useHeader = externalModel === undefined && typeof props.renderHeader === "function";
    const headerStore = useCellContainers<Gtk.ColumnView>({
        target: useHeader ? widgetRef : null,
        installer: headerFactoryInstaller,
        estimatedHeight: props.estimatedItemHeight ?? undefined,
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
            resolver: listModel.resolver as ItemResolver<unknown, unknown>,
            register: registry.register,
            unregister: registry.unregister,
        }),
        [listModel.resolver, registry.register, registry.unregister],
    );

    return {
        setRef,
        resolver: listModel.resolver,
        headerResolver: listModel.headerResolver,
        headerStore,
        useHeader,
        contextValue,
    };
};

/**
 * A `GtkColumnView` driven by a declarative `items`/`sections` model with
 * optional controlled selection, controlled sorting, and section headers.
 * Columns are declared as {@link ColumnViewColumn} children. Supplying an
 * external `model` switches to the uncontrolled form.
 */
export const ColumnView = <T = unknown, S = unknown>(props: ColumnViewProps<T, S>): ReactNode => {
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
