import type * as Gtk from "@gtkx/gi/gtk";
import { GtkColumnView, type GtkColumnViewProps } from "@gtkx/jsx/gtk";
import { type ReactNode, type Ref, useCallback, useMemo, useState } from "react";
import { createTreeRenderContext, HeaderRenderHost, type TreeRenderContext } from "./cell.js";
import { type ColumnDef, ColumnViewColumn } from "./column-view-column.js";
import { makeFactoryInstaller } from "./hooks/use-cell-containers.js";
import { useCollectionHeader } from "./hooks/use-collection-header.js";
import { type ColumnRegistration, useSortHandler } from "./hooks/use-sort-handler.js";
import type {
    CollectionItemSizeProps,
    ControlledExpansionProps,
    ControlledSelectionProps,
    ItemNode,
    SectionNode,
} from "./types.js";
import type { CellContainerStore } from "./utils/cell-container-store.js";
import type { ItemResolver } from "./utils/item-resolver.js";

export type { ColumnDef, ColumnDefDeclarativeProps } from "./column-view-column.js";

const headerFactoryInstaller = makeFactoryInstaller<Gtk.ColumnView>((widget, factory) =>
    widget.setHeaderFactory(factory),
);

export type ColumnViewSortProps = {
    sortColumn?: string | null | undefined;
    sortOrder?: Gtk.SortType | null | undefined;
    onSortChanged?: ((column: string | null, order: Gtk.SortType) => void) | null | undefined;
};

export type ColumnViewDeclarativeProps<T = unknown, S = unknown> = ColumnViewSortProps &
    Omit<CollectionItemSizeProps, "estimatedItemWidth"> &
    ControlledSelectionProps &
    ControlledExpansionProps & {
        items?: ItemNode<T>[] | undefined;
        sections?: SectionNode<S, T>[] | undefined;
        renderHeader?: ((info: { section: S }) => ReactNode) | null | undefined;
        columns: ColumnDef<T>[];
    };

/**
 * Props for {@link ColumnView}. Combines the underlying Gtk.ColumnView props with
 * declarative collection props: flat items or grouped sections, controlled selection
 * and expansion, sorting (sortColumn, sortOrder, onSortChanged), an optional section
 * header renderer, and the columns to render.
 */
export type ColumnViewProps<T = unknown, S = unknown> = Omit<
    GtkColumnViewProps,
    "columns" | "model" | "headerFactory" | keyof ColumnViewDeclarativeProps<T, S>
> &
    ColumnViewDeclarativeProps<T, S>;

type NormalizedColumnViewProps<T, S> = ColumnViewDeclarativeProps<T, S> & {
    ref?: Ref<Gtk.ColumnView | null>;
    [key: string]: unknown;
};

interface ColumnViewWiring<T, S> {
    setRef: (value: Gtk.ColumnView | null) => void;
    useHeader: boolean;
    headerStore: CellContainerStore;
    headerResolver: ItemResolver<T, S>;
    resolver: ItemResolver<unknown, unknown>;
    tree: TreeRenderContext;
    setInstance: (id: string, column: Gtk.ColumnViewColumn | null) => void;
}

const useColumnInstances = (): {
    instances: Map<string, Gtk.ColumnViewColumn>;
    setInstance: (id: string, column: Gtk.ColumnViewColumn | null) => void;
} => {
    const [instances, setInstances] = useState<Map<string, Gtk.ColumnViewColumn>>(() => new Map());
    const setInstance = useCallback((id: string, column: Gtk.ColumnViewColumn | null): void => {
        setInstances((current) => {
            if (column === null) {
                if (!current.has(id)) return current;
                const next = new Map(current);
                next.delete(id);
                return next;
            }
            if (current.get(id) === column) return current;
            const next = new Map(current);
            next.set(id, column);
            return next;
        });
    }, []);
    return { instances, setInstance };
};

const buildRegistrations = <T,>(
    columns: ColumnDef<T>[],
    instances: Map<string, Gtk.ColumnViewColumn>,
): ColumnRegistration[] => {
    const result: ColumnRegistration[] = [];
    for (const column of columns) {
        const instance = instances.get(column.id);
        if (instance) result.push({ id: column.id, column: instance, sortable: column.sortable ?? false });
    }
    return result;
};

const useColumnViewWiring = <T, S>(props: NormalizedColumnViewProps<T, S>): ColumnViewWiring<T, S> => {
    const { widgetRef, setRef, collection, useHeader, headerStore } = useCollectionHeader<Gtk.ColumnView, T, S>(
        props,
        headerFactoryInstaller,
    );

    const { instances, setInstance } = useColumnInstances();
    const registrations = useMemo<ColumnRegistration[]>(
        () => buildRegistrations(props.columns, instances),
        [props.columns, instances],
    );

    useSortHandler({
        columnView: widgetRef,
        sortColumn: props.sortColumn,
        sortOrder: props.sortOrder,
        onSortChanged: props.onSortChanged,
        columns: registrations,
    });

    const expandedIds = props.expandedIds;
    const tree = useMemo<TreeRenderContext>(
        () => createTreeRenderContext(expandedIds, collection.rowId),
        [expandedIds, collection.rowId],
    );

    return {
        setRef,
        useHeader,
        headerStore,
        headerResolver: collection.headerResolver,
        resolver: collection.resolver as ItemResolver<unknown, unknown>,
        tree,
        setInstance,
    };
};

/**
 * Renders a Gtk.ColumnView: a multi-column, scrollable list backed by a collection
 * model. Columns are declared through the columns prop, each a {@link ColumnDef}.
 */
export const ColumnView = <T = unknown, S = unknown>(props: ColumnViewProps<T, S>): ReactNode => {
    const normalized = props as NormalizedColumnViewProps<T, S>;
    const wiring = useColumnViewWiring<T, S>(normalized);
    const {
        ref,
        items,
        sections,
        columns,
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
        ...intrinsicProps
    } = normalized;

    return (
        <>
            <GtkColumnView {...intrinsicProps} ref={wiring.setRef}>
                {columns.map((column) => (
                    <ColumnViewColumn
                        key={column.id}
                        {...column}
                        resolver={wiring.resolver}
                        tree={wiring.tree}
                        estimatedItemHeight={estimatedItemHeight}
                        onInstance={wiring.setInstance}
                    />
                ))}
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
