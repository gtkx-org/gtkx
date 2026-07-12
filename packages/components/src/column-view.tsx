import type * as Gtk from "@gtkx/gi/gtk";
import { GtkColumnView, type GtkColumnViewProps } from "@gtkx/jsx/gtk";
import { useMergeRefs } from "@gtkx/react/internal";
import { type ReactNode, type Ref, type RefObject, useCallback, useMemo, useRef, useState } from "react";
import { HeaderRenderHost } from "./cell.js";
import { ColumnViewColumn, type ColumnViewColumnProps } from "./column-view-column.js";
import { type ColumnRegistration, ColumnViewContext, type ColumnViewContextValue } from "./column-view-context.js";
import { type FactoryInstaller, useCellContainers } from "./hooks/use-cell-containers.js";
import { type CollectionModelResult, useCollectionModel } from "./hooks/use-collection-model.js";
import { useInstalledModel } from "./hooks/use-installed-model.js";
import { useSortHandler } from "./hooks/use-sort-handler.js";
import type {
    CollectionItemSizeProps,
    ControlledExpansionProps,
    ControlledSelectionProps,
    ItemNode,
    SectionNode,
} from "./types.js";
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

/** API object passed to a {@link ColumnView} render-prop child, exposing the Column component bound to the view's item type. */
export type ColumnViewApi<T = unknown> = {
    Column: (props: ColumnViewColumnProps<T>) => ReactNode;
};

type ColumnViewChildren<T> = ReactNode | ((api: ColumnViewApi<T>) => ReactNode);

type ColumnViewDeclarativeProps<T = unknown, S = unknown> = ColumnViewSortProps &
    Omit<CollectionItemSizeProps, "estimatedItemWidth"> &
    ControlledSelectionProps &
    ControlledExpansionProps & {
        items?: ItemNode<T>[] | undefined;
        sections?: SectionNode<S, T>[] | undefined;
        renderHeader?: ((info: { section: S }) => ReactNode) | null | undefined;
        children?: ColumnViewChildren<T>;
    };

/**
 * Props for {@link ColumnView}. Combines the underlying Gtk.ColumnView props with
 * declarative collection props: flat items or grouped sections, controlled selection
 * and expansion, sorting (sortColumn, sortOrder, onSortChanged), an optional section
 * header renderer, and column children declared as elements or a render prop.
 */
export type ColumnViewProps<T = unknown, S = unknown> = Omit<
    GtkColumnViewProps,
    "columns" | "model" | "headerFactory" | keyof ColumnViewDeclarativeProps<T, S>
> &
    ColumnViewDeclarativeProps<T, S>;

type NormalizedColumnViewProps<T, S> = ColumnViewDeclarativeProps<T, S> & {
    ref?: Ref<Gtk.ColumnView | null>;
    renderHeader?: ((info: { section: S }) => ReactNode) | null;
    [key: string]: unknown;
};

interface ColumnViewWiring<T, S> {
    setRef: (value: Gtk.ColumnView | null) => void;
    headerResolver: ItemResolver<T, S>;
    headerStore: CellContainerStore;
    useHeader: boolean;
    contextValue: ColumnViewContextValue;
}

type ColumnViewContextInput<T, S> = {
    columnView: RefObject<Gtk.ColumnView | null>;
    collection: CollectionModelResult<T, S>;
    expandedIds: string[] | null | undefined;
    estimatedItemHeight: number | undefined;
    registry: ColumnRegistry;
};

const useColumnViewContextValue = <T, S>({
    columnView,
    collection,
    expandedIds,
    estimatedItemHeight,
    registry,
}: ColumnViewContextInput<T, S>): ColumnViewContextValue =>
    useMemo(
        () => ({
            columnView,
            resolver: collection.resolver as ItemResolver<unknown, unknown>,
            tree: {
                controlled: expandedIds !== undefined && expandedIds !== null,
                expandedIds: new Set(expandedIds ?? []),
                rowId: collection.rowId,
            },
            estimatedItemHeight,
            register: registry.register,
            unregister: registry.unregister,
        }),
        [
            columnView,
            collection.resolver,
            collection.rowId,
            expandedIds,
            estimatedItemHeight,
            registry.register,
            registry.unregister,
        ],
    );

const useColumnViewWiring = <T, S>(
    props: NormalizedColumnViewProps<T, S>,
    registry: ColumnRegistry,
): ColumnViewWiring<T, S> => {
    const widgetRef = useRef<Gtk.ColumnView | null>(null);
    const setRef = useMergeRefs<Gtk.ColumnView>(props.ref, widgetRef);

    const collection = useCollectionModel<T, S>({
        items: props.items,
        sections: props.sections,
        selectionMode: props.selectionMode,
        selectedIds: props.selectedIds,
        onSelectionChanged: props.onSelectionChanged,
        expandedIds: props.expandedIds,
        onExpandedChange: props.onExpandedChange,
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

    const contextValue = useColumnViewContextValue<T, S>({
        columnView: widgetRef,
        collection,
        expandedIds: props.expandedIds,
        estimatedItemHeight: props.estimatedItemHeight,
        registry,
    });

    return {
        setRef,
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
        selectedIds,
        selectionMode,
        onSelectionChanged,
        expandedIds,
        onExpandedChange,
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
            selectedIds,
            selectionMode,
            onSelectionChanged,
            expandedIds,
            onExpandedChange,
            sortColumn,
            sortOrder,
            onSortChanged,
            renderHeader,
            estimatedItemHeight,
        } as NormalizedColumnViewProps<T, S>,
        registry,
    );

    const resolvedChildren = typeof children === "function" ? children({ Column: ColumnViewColumn }) : children;

    return (
        <>
            <GtkColumnView {...intrinsicProps} ref={wiring.setRef}>
                <ColumnViewContext.Provider value={wiring.contextValue}>{resolvedChildren}</ColumnViewContext.Provider>
            </GtkColumnView>
            <HeaderRenderHost
                useHeader={wiring.useHeader}
                store={wiring.headerStore}
                resolver={wiring.headerResolver}
                renderHeader={renderHeader}
            />
        </>
    );
};

/**
 * Renders a Gtk.ColumnView: a multi-column, scrollable list backed by a collection
 * model. Columns are declared with {@link ColumnView.Column}, either as children or
 * through the render-prop form that receives a typed {@link ColumnViewApi}.
 */
export const ColumnView: typeof ColumnViewComponent & {
    Column: typeof ColumnViewColumn;
} = Object.assign(ColumnViewComponent, { Column: ColumnViewColumn });
