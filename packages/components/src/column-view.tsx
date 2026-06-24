import type * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkColumnView, type GtkColumnViewProps } from "@gtkx/jsx/gtk";
import { useForwardedRef } from "@gtkx/react";
import { createElement, type ReactNode, type Ref, useCallback, useMemo, useRef, useState } from "react";
import {
    type ColumnRegistration,
    ColumnViewContext,
    type ColumnViewContextValue,
} from "./contexts/column-view-context.js";
import { useListModel } from "./hooks/use-list-model.js";
import { useInstalledModel } from "./hooks/use-installed-model.js";
import { type FactoryInstaller, useCellContainers } from "./hooks/use-cell-containers.js";
import { useSelectionModel } from "./hooks/use-selection-model.js";
import { useSortHandler } from "./hooks/use-sort-handler.js";
import { CellRenderHost } from "./cell-render-host.js";
import type { CellRenderer } from "./list-cell.js";
import type { ColumnViewProps } from "./types.js";
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

/**
 * Props for the {@link ColumnView} component: the raw `GtkColumnView` element
 * surface (minus its imperative `columns` property) with its model/sort wiring
 * replaced by the declarative {@link ColumnViewProps} API. Columns are declared
 * as {@link ColumnViewColumn} children.
 */
export type ColumnViewComponentProps<T = unknown, S = unknown> = Omit<
    GtkColumnViewProps,
    "columns" | keyof ColumnViewProps<T, S>
> &
    ColumnViewProps<T, S>;

type NormalizedColumnViewProps<T, S> = ColumnViewProps<T, S> & {
    ref?: Ref<Gtk.ColumnView | null>;
    renderHeader?: ((value: S) => ReactNode) | null;
    children?: ReactNode;
    [key: string]: unknown;
};

const headerRenderer =
    <T, S>(renderHeader: ((value: S) => ReactNode) | null | undefined): CellRenderer<T, S> =>
    (value) =>
        renderHeader ? renderHeader(value as S) : null;

interface ColumnViewWiring<T, S> {
    setRef: (value: Gtk.ColumnView | null) => void;
    resolver: ItemResolver<T, S>;
    headerResolver: ItemResolver<T, S>;
    headerStore: ReturnType<typeof useCellContainers>["store"];
    useHeader: boolean;
    contextValue: ColumnViewContextValue;
}

const useColumnViewWiring = <T, S>(
    props: NormalizedColumnViewProps<T, S>,
    registry: ColumnRegistry,
): ColumnViewWiring<T, S> => {
    const widgetRef = useRef<Gtk.ColumnView | null>(null);
    const captureWidget = useCallback((value: Gtk.ColumnView | null) => {
        widgetRef.current = value;
    }, []);
    const [, setRef] = useForwardedRef<Gtk.ColumnView>(props.ref, captureWidget);

    const externalModel = props.model as Gio.ListModel | undefined;
    const listModel = useListModel<T, S>(
        externalModel === undefined ? { items: props.items } : { model: externalModel },
    );

    const controlledSelection = useSelectionModel<T, S>({
        base: listModel.model,
        selectionMode: props.selectionMode,
        selected: props.selected,
        onSelectionChanged: props.onSelectionChanged,
        resolver: listModel.resolver,
    });
    const installedModel: Gtk.SelectionModel =
        externalModel === undefined ? controlledSelection : (externalModel as Gtk.SelectionModel);
    useInstalledModel(widgetRef, installedModel, (widget, model) => widget.setModel(model));

    const useHeader = externalModel === undefined && typeof props.renderHeader === "function";
    const headers = useCellContainers<Gtk.ColumnView>({
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
        headerStore: headers.store,
        useHeader,
        contextValue,
    };
};

/**
 * A `GtkColumnView` driven by a declarative `items` model with optional
 * controlled selection, controlled sorting, and section headers. Columns are
 * declared as {@link ColumnViewColumn} children. Supplying an external `model`
 * switches to the uncontrolled form.
 */
export const ColumnView = <T = unknown, S = unknown>(props: ColumnViewComponentProps<T, S>): ReactNode => {
    const {
        ref,
        items,
        model,
        selected,
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
            model,
            selected,
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
