import type * as Adw from "@gtkx/ffi/adw";
import type * as Gtk from "@gtkx/ffi/gtk";
import { createElement, Fragment, type ReactNode, type Ref, useState, useSyncExternalStore } from "react";
import type {
    AdwComboRowProps,
    GtkColumnViewProps,
    GtkDropDownProps,
    GtkGridViewProps,
    GtkListViewProps,
} from "../generated/jsx.js";
import type {
    ColumnViewColumnProps,
    DropDownProps,
    GridViewProps,
    ListItem,
    ListViewProps,
    MenuItemProps,
    MenuSectionProps,
    MenuSubmenuProps,
} from "../jsx.js";
import { createPortal } from "../portal.js";
import { BoundItemsStore } from "./bound-items-store.js";
import { createVirtualChild } from "./compound.js";

type GenericListViewProps<T, S> = Omit<GtkListViewProps, keyof ListViewProps> & ListViewProps<T, S>;
type GenericGridViewProps<T> = Omit<GtkGridViewProps, keyof GridViewProps> & GridViewProps<T>;
type GenericDropDownProps<T, S> = Omit<GtkDropDownProps, keyof DropDownProps> & DropDownProps<T, S>;
type GenericComboRowProps<T, S> = Omit<AdwComboRowProps, keyof DropDownProps> & DropDownProps<T, S>;
type GenericColumnViewProps<T, S> = Omit<GtkColumnViewProps, "items" | "renderHeader"> & {
    items?: ListItem<T, S>[];
    renderHeader?: ((item: S) => ReactNode) | null;
};

function useListHandle() {
    const [store] = useState(() => new BoundItemsStore());
    const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
    return { store, snapshot };
}

function renderListElement(intrinsicName: string, handle: ReturnType<typeof useListHandle>, props: object): ReactNode {
    const { store, snapshot } = handle;

    const portals: ReactNode[] = [];
    for (const [content, container, key] of snapshot.boundItems) {
        portals.push(createPortal(content, container, key));
    }
    for (const [content, container, key] of snapshot.headerBoundItems) {
        portals.push(createPortal(content, container, key));
    }

    return createElement(
        Fragment,
        null,
        createElement(intrinsicName, {
            ...(props as Record<string, unknown>),
            __boundItemsStore: store,
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
