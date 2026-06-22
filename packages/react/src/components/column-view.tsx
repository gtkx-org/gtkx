import type * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import { createElement, type ReactNode, type Ref, useCallback, useMemo, useRef, useState } from "react";
import {
    type ColumnRegistration,
    ColumnViewContext,
    type ColumnViewContextValue,
} from "../contexts/column-view-context.js";
import { useForwardedRef } from "../hooks/use-forwarded-ref.js";
import { useListModel } from "../hooks/use-list-model.js";
import { type FactoryBinding, useRealizedSlots } from "../hooks/use-realized-slots.js";
import { useSelectionModel } from "../hooks/use-selection-model.js";
import { useSortHandler } from "../hooks/use-sort-handler.js";
import type { ColumnViewProps } from "../utils/element-props.js";
import type { ItemResolver } from "../utils/item-resolver.js";
import { useTargetRegistration } from "../utils/use-target-registration.js";
import { ListPortalHost } from "./list-portal-host.js";
import type { SlotRenderer } from "./list-slot.js";

const COLUMN_VIEW_ELEMENT = "GtkColumnView";

const headerFactoryBinding: FactoryBinding<Gtk.ColumnView> = {
    install: (widget, factory) => widget.setHeaderFactory(factory),
    uninstall: (widget) => widget.setHeaderFactory(null),
};

const useModelInstallation = (target: React.RefObject<Gtk.ColumnView | null>, model: Gtk.SelectionModel): void => {
    useTargetRegistration<Gtk.ColumnView, { widget: Gtk.ColumnView; model: Gtk.SelectionModel }>(target, {
        attach: (widget) => {
            widget.setModel(model);
            return { widget, model };
        },
        detach: () => {},
        isSame: (registration, widget) => registration.widget === widget && registration.model === model,
    });
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

type ColumnViewComponentProps<T, S> = ColumnViewProps<T, S> & {
    ref?: Ref<Gtk.ColumnView | null> | undefined;
    children?: ReactNode;
};

type NormalizedColumnViewProps<T, S> = ColumnViewProps<T, S> & {
    ref?: Ref<Gtk.ColumnView | null>;
    renderHeader?: ((value: S) => ReactNode) | null;
    children?: ReactNode;
    [key: string]: unknown;
};

const headerRenderer =
    <T, S>(renderHeader: ((value: S) => ReactNode) | null | undefined): SlotRenderer<T, S> =>
    (value) =>
        renderHeader ? renderHeader(value as S) : null;

interface ColumnViewWiring<T, S> {
    setRef: (value: Gtk.ColumnView | null) => void;
    resolver: ItemResolver<T, S>;
    headerResolver: ItemResolver<T, S>;
    headerStore: ReturnType<typeof useRealizedSlots>["store"];
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
    useModelInstallation(widgetRef, installedModel);

    const useHeader = externalModel === undefined && typeof props.renderHeader === "function";
    const headers = useRealizedSlots<Gtk.ColumnView>({
        target: useHeader ? widgetRef : null,
        binding: headerFactoryBinding,
        estimatedHeight: props.estimatedRowHeight ?? undefined,
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

export const GtkColumnView = <T = unknown, S = unknown>(props: ColumnViewComponentProps<T, S>): ReactNode => {
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
        estimatedRowHeight,
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
            estimatedRowHeight,
        } as NormalizedColumnViewProps<T, S>,
        registry,
    );

    const intrinsic = createElement(
        COLUMN_VIEW_ELEMENT,
        { ...intrinsicProps, ref: wiring.setRef },
        <ColumnViewContext.Provider value={wiring.contextValue}>{children}</ColumnViewContext.Provider>,
    );

    return (
        <>
            {intrinsic}
            {wiring.useHeader ? (
                <ListPortalHost
                    store={wiring.headerStore}
                    resolver={wiring.headerResolver}
                    render={headerRenderer<T, S>(renderHeader)}
                />
            ) : null}
        </>
    );
};
