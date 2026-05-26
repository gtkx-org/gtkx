import type * as Adw from "@gtkx/ffi/adw";
import type * as Gtk from "@gtkx/ffi/gtk";
import { createElement, Fragment, type ReactNode, type Ref, useReducer, useRef } from "react";
import type {
    AdwComboRowProps,
    GtkColumnViewProps,
    GtkDropDownProps,
    GtkGridViewProps,
    GtkListViewProps,
} from "../generated/jsx.js";
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
import { createVirtualChild } from "./compound.js";

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

function renderListElement(intrinsicName: string, handle: ReturnType<typeof useListHandle>, props: object): ReactNode {
    const { rerender, boundItemsRef, headerBoundItemsRef } = handle;

    const portals: ReactNode[] = [];
    for (const [content, container, key] of boundItemsRef.current) {
        portals.push(createPortal(content, container, key));
    }
    for (const [content, container, key] of headerBoundItemsRef.current) {
        portals.push(createPortal(content, container, key));
    }

    return createElement(
        Fragment,
        null,
        createElement(intrinsicName, {
            ...(props as Record<string, unknown>),
            __boundItemsRef: boundItemsRef,
            __rerender: rerender,
            __headerBoundItemsRef: headerBoundItemsRef,
        }),
        ...portals,
    );
}

/**
 * Virtualized scrollable list that renders items from a flat or tree data model.
 *
 * Wraps `GtkListView` with React-managed item rendering via portals,
 * supporting single/multi selection, section headers, and tree expansion.
 */
export function GtkListView<T = unknown, S = unknown>(
    props: GenericListViewProps<T, S> & { children?: ReactNode; ref?: Ref<Gtk.ListView> },
): ReactNode {
    return renderListElement("GtkListView", useListHandle(), props);
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
    return renderListElement("GtkGridView", useListHandle(), props);
}

/** @internal */
function GtkColumnViewBase<T = unknown, S = unknown>(
    props: GenericColumnViewProps<T, S> & { children?: ReactNode; ref?: Ref<Gtk.ColumnView> },
): ReactNode {
    return renderListElement("GtkColumnView", useListHandle(), props);
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
    Column: <T = unknown>(props: ColumnViewColumnProps<T>) => ReactNode;
    MenuItem: (props: MenuItemProps) => ReactNode;
    MenuSection: (props: MenuSectionProps) => ReactNode;
    MenuSubmenu: (props: MenuSubmenuProps) => ReactNode;
} = Object.assign(GtkColumnViewBase, {
    Column: <T = unknown>(props: ColumnViewColumnProps<T>): ReactNode =>
        createElement("ColumnViewColumn", props, props.children),
    MenuItem: createVirtualChild<MenuItemProps>("MenuItem"),
    MenuSection: createVirtualChild<MenuSectionProps>("MenuSection"),
    MenuSubmenu: createVirtualChild<MenuSubmenuProps>("MenuSubmenu"),
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
    return renderListElement("GtkDropDown", useListHandle(), props);
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
    return renderListElement("AdwComboRow", useListHandle(), props);
}
