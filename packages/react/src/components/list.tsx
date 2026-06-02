import type * as Adw from "@gtkx/gi/adw";
import type * as Gtk from "@gtkx/gi/gtk";
import type {
    AdwComboRowProps,
    GtkColumnViewProps,
    GtkDropDownProps,
    GtkGridViewProps,
    GtkListViewProps,
} from "@gtkx/react-jsx/jsx";
import { createElement, type ReactNode, type Ref, useReducer, useRef } from "react";
import type {
    ColumnViewColumnProps,
    ColumnViewProps,
    DropDownProps,
    GridViewProps,
    ListViewProps,
    MenuItemProps,
    MenuSectionProps,
    MenuSubmenuProps,
} from "../jsx.js";
import type { BoundItem } from "../nodes/internal/bound-item.js";
import { createPortal } from "../portal.js";

const GtkListViewElement = "GtkListView" as const;
const GtkGridViewElement = "GtkGridView" as const;
const GtkColumnViewElement = "GtkColumnView" as const;
const GtkDropDownElement = "GtkDropDown" as const;
const AdwComboRowElement = "AdwComboRow" as const;
const ColumnViewColumnElement = "ColumnViewColumn" as const;
const MenuItemElement = "MenuItem" as const;
const MenuSectionElement = "MenuSection" as const;
const MenuSubmenuElement = "MenuSubmenu" as const;

type ListViewOwnKeys =
    | "items"
    | "model"
    | "renderItem"
    | "renderHeader"
    | "autoexpand"
    | "selected"
    | "onSelectionChanged"
    | "selectionMode"
    | "estimatedItemHeight"
    | "estimatedItemWidth";
type DropDownOwnKeys =
    | "items"
    | "model"
    | "renderItem"
    | "renderListItem"
    | "renderHeader"
    | "selectedId"
    | "onSelectionChanged";
type ColumnViewOwnKeys = "items" | "model" | "renderHeader" | "selected" | "onSelectionChanged" | "selectionMode";

type GenericListViewProps<T, S> = Omit<GtkListViewProps, ListViewOwnKeys> & ListViewProps<T, S>;
type GenericGridViewProps<T> = Omit<GtkGridViewProps, ListViewOwnKeys> & GridViewProps<T>;
type GenericDropDownProps<T, S> = Omit<GtkDropDownProps, DropDownOwnKeys> & DropDownProps<T, S>;
type GenericComboRowProps<T, S> = Omit<AdwComboRowProps, DropDownOwnKeys> & DropDownProps<T, S>;
type GenericColumnViewProps<T, S> = Omit<GtkColumnViewProps, ColumnViewOwnKeys> & ColumnViewProps<T, S>;

function useListHandle() {
    const [, rerender] = useReducer((x: number) => x + 1, 0);
    const boundItemsRef = useRef<BoundItem[]>([]);
    const headerBoundItemsRef = useRef<BoundItem[]>([]);
    return { rerender, boundItemsRef, headerBoundItemsRef };
}

type ListHandle = ReturnType<typeof useListHandle>;

type ListReconcilerProps = {
    readonly __boundItemsRef: { current: BoundItem[] };
    readonly __rerender: () => void;
    readonly __headerBoundItemsRef: { current: BoundItem[] };
};

const listElementProps = <P extends object>(props: P, handle: ListHandle): P & ListReconcilerProps => ({
    ...props,
    __boundItemsRef: handle.boundItemsRef,
    __rerender: handle.rerender,
    __headerBoundItemsRef: handle.headerBoundItemsRef,
});

const withPortals = (element: ReactNode, handle: ListHandle): ReactNode => {
    const portals: ReactNode[] = [];
    for (const [content, container, key] of [...handle.boundItemsRef.current, ...handle.headerBoundItemsRef.current]) {
        portals.push(createPortal(content, container, key));
    }
    return (
        <>
            {element}
            {portals}
        </>
    );
};

/**
 * Renders a virtualized list intrinsic element with its bound-item portals.
 *
 * Each public list component is a thin generic-typed wrapper over this hook:
 * it threads the reconciler refs into the element props and emits the element
 * plus its portals, so the only per-component difference is the element name
 * and the public prop type.
 */
const useListElement = (elementType: string, props: object): ReactNode => {
    const handle = useListHandle();
    return withPortals(createElement(elementType, listElementProps(props, handle)), handle);
};

/**
 * Virtualized scrollable list that renders items from a flat or tree data model.
 *
 * Wraps `GtkListView` with React-managed item rendering via portals,
 * supporting single/multi selection, section headers, and tree expansion.
 */
export function GtkListView<T = unknown, S = unknown>(
    props: GenericListViewProps<T, S> & { children?: ReactNode; ref?: Ref<Gtk.ListView> },
): ReactNode {
    return useListElement(GtkListViewElement, props);
}

/**
 * Virtualized scrollable grid that renders items in a multi-column layout.
 *
 * Wraps `GtkGridView` with React-managed item rendering via portals,
 * supporting single/multi selection.
 */
export function GtkGridView<T = unknown>(
    props: GenericGridViewProps<T> & { children?: ReactNode; ref?: Ref<Gtk.GridView> },
): ReactNode {
    return useListElement(GtkGridViewElement, props);
}

/** @internal */
function GtkColumnViewBase<T = unknown, S = unknown>(
    props: GenericColumnViewProps<T, S> & { children?: ReactNode; ref?: Ref<Gtk.ColumnView> },
): ReactNode {
    return useListElement(GtkColumnViewElement, props);
}

/**
 * Multi-column sortable list with React-managed cell rendering.
 *
 * Wraps `GtkColumnView` with portal-based factories. Use the
 * `GtkColumnView.Column` compound component to define columns,
 * and the `MenuItem` / `MenuSection` / `MenuSubmenu` compounds
 * for the column header context menu.
 */
export const GtkColumnView: typeof GtkColumnViewBase & {
    /** Defines a column, with header and per-row cell rendering. */
    Column: <T = unknown>(props: ColumnViewColumnProps<T>) => ReactNode;
    /** A menu item in a column header's context menu. */
    MenuItem: (props: MenuItemProps) => ReactNode;
    /** A grouping section in a column header's context menu. */
    MenuSection: (props: MenuSectionProps) => ReactNode;
    /** A nested submenu in a column header's context menu. */
    MenuSubmenu: (props: MenuSubmenuProps) => ReactNode;
} = Object.assign(GtkColumnViewBase, {
    Column: <T = unknown>(props: ColumnViewColumnProps<T>): ReactNode => (
        <ColumnViewColumnElement {...(props as ColumnViewColumnProps)} />
    ),
    MenuItem: (props: MenuItemProps): ReactNode => <MenuItemElement {...props} />,
    MenuSection: (props: MenuSectionProps): ReactNode => <MenuSectionElement {...props} />,
    MenuSubmenu: (props: MenuSubmenuProps): ReactNode => <MenuSubmenuElement {...props} />,
});

/**
 * Single-selection dropdown widget with React-managed item rendering.
 *
 * Wraps `GtkDropDown` with portal-based factories, supporting custom
 * item templates, separate list-item templates, and section headers.
 */
export function GtkDropDown<T = unknown, S = unknown>(
    props: GenericDropDownProps<T, S> & { children?: ReactNode; ref?: Ref<Gtk.DropDown> },
): ReactNode {
    return useListElement(GtkDropDownElement, props);
}

/**
 * Libadwaita combo row with React-managed item rendering.
 *
 * Wraps `AdwComboRow` with portal-based factories, providing a
 * preferences-style dropdown row with custom item templates and
 * section headers.
 */
export function AdwComboRow<T = unknown, S = unknown>(
    props: GenericComboRowProps<T, S> & { children?: ReactNode; ref?: Ref<Adw.ComboRow> },
): ReactNode {
    return useListElement(AdwComboRowElement, props);
}
