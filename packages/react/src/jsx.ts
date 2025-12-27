import type * as Gtk from "@gtkx/ffi/gtk";
import type { ReactElement, ReactNode } from "react";
import { createElement } from "react";
import type { RenderItemFn } from "./nodes/internal/list-item-renderer.js";

export type SlotProps = {
    id?: string;
    children?: ReactNode;
};

export type ListItemProps<T = unknown> = {
    id: string;

    value: T;
};

export type StringListItemProps = {
    id: string;

    value: string;
};

export type GridChildProps = SlotProps & {
    column?: number;
    row?: number;
    columnSpan?: number;
    rowSpan?: number;
};

export type ListViewRenderProps<T = unknown> = {
    renderItem: RenderItemFn<T>;
};

export type ColumnViewColumnProps<T = unknown> = {
    title: string;

    expand?: boolean;

    resizable?: boolean;

    fixedWidth?: number;

    id: string;

    sortable?: boolean;

    renderCell: (item: T | null) => ReactElement;
};

export type ColumnViewRootProps<C extends string = string> = {
    sortColumn?: C | null;

    sortOrder?: Gtk.SortType;

    onSortChange?: (column: C | null, order: Gtk.SortType) => void;
};

export type NotebookPageProps = SlotProps & {
    label: string;
};

export type StackRootProps = SlotProps & {
    visibleChildName?: string;
};

export type StackPageProps = SlotProps & {
    name?: string;
    title?: string;
    iconName?: string;
    needsAttention?: boolean;
    visible?: boolean;
    useUnderline?: boolean;

    badgeNumber?: number;
};

export type MenuItemProps = {
    id: string;

    label: string;

    onActivate: () => void;

    accels?: string | string[];
};

export type MenuSectionProps = {
    label?: string;
    children?: ReactNode;
};

export type MenuSubmenuProps = {
    label: string;
    children?: ReactNode;
};

export type OverlayChildProps = SlotProps & {
    measure?: boolean;

    clipOverlay?: boolean;
};

export type { WidgetSlotNames } from "./generated/jsx.js";

export function Slot<W extends keyof import("./generated/jsx.js").WidgetSlotNames>(props: {
    for: W;

    id: import("./generated/jsx.js").WidgetSlotNames[W];
    children?: ReactNode;
}): ReactElement {
    return createElement("Slot", { id: props.id }, props.children);
}

export const StackPage = "StackPage" as const;

export const GridChild = "GridChild" as const;

export const NotebookPage = "NotebookPage" as const;

export const ListItem = "ListItem" as const;

export function ColumnViewColumn<T = unknown>(props: ColumnViewColumnProps<T>): ReactElement {
    return createElement("ColumnViewColumn", props);
}

export type ListViewProps<T = unknown> = Omit<import("./generated/jsx.js").GtkListViewProps, "renderItem"> & {
    renderItem: (item: T | null) => ReactElement;
};

export function ListView<T = unknown>(props: ListViewProps<T>): ReactElement {
    return createElement("GtkListView", props);
}

export type GridViewProps<T = unknown> = Omit<import("./generated/jsx.js").GtkGridViewProps, "renderItem"> & {
    renderItem: (item: T | null) => ReactElement;
};

export function GridView<T = unknown>(props: GridViewProps<T>): ReactElement {
    return createElement("GtkGridView", props);
}

export const SimpleListItem = "SimpleListItem" as const;

export const Pack = {
    Start: "Pack.Start" as const,
    End: "Pack.End" as const,
};

export const Toolbar = {
    Top: "Toolbar.Top" as const,
    Bottom: "Toolbar.Bottom" as const,
};

export const Overlay = "Overlay" as const;

export const OverlayChild = "OverlayChild" as const;

export const Menu = {
    Item: "Menu.Item" as const,
    Section: "Menu.Section" as const,
    Submenu: "Menu.Submenu" as const,
};

declare global {
    namespace React {
        namespace JSX {
            interface IntrinsicElements {
                StackPage: StackPageProps;

                GridChild: GridChildProps;

                NotebookPage: NotebookPageProps;

                ListItem: ListItemProps;

                // biome-ignore lint/suspicious/noExplicitAny: Required for contravariant behavior
                ColumnViewColumn: ColumnViewColumnProps<any>;
                SimpleListItem: StringListItemProps;

                "Pack.Start": SlotProps;
                "Pack.End": SlotProps;

                "Toolbar.Top": SlotProps;
                "Toolbar.Bottom": SlotProps;

                OverlayChild: OverlayChildProps;

                "Menu.Item": MenuItemProps;
                "Menu.Section": MenuSectionProps;
                "Menu.Submenu": MenuSubmenuProps;
            }
        }
    }
}

export * from "./generated/jsx.js";
