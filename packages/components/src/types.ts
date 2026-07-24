import type * as Gdk from "@gtkx/gi/gdk";
import type * as Gio from "@gtkx/gi/gio";
import type * as Gsk from "@gtkx/gi/gsk";
import type * as Gtk from "@gtkx/gi/gtk";
import type { GMenuProps } from "@gtkx/jsx/gio";
import type {
    GtkColumnViewColumnProps,
    GtkColumnViewProps,
    GtkDropDown,
    GtkFixedProps,
    GtkGridProps,
    GtkGridViewProps,
    GtkListViewProps,
    GtkOverlayProps,
} from "@gtkx/jsx/gtk";
import type { ComponentPropsWithRef, ElementType, ReactNode, Ref } from "react";

/** Props of a container's Child component: the widget to render, its own props, and any placement props. */
export type ChildProps<C extends ElementType, Placement = unknown> = Placement & {
    component: C;
} & Omit<ComponentPropsWithRef<C>, keyof Placement>;

/** Props of a component whose backing widget defaults to one type but can be swapped through `component`. */
export type WidgetProps<C extends ElementType, Own = unknown, ExtraOmit extends string = never> = Own & {
    component?: C;
} & Omit<ComponentPropsWithRef<C>, ExtraOmit | keyof Own>;

/**
 * A single item in a collection model, identified by a stable id and holding an
 * arbitrary value. Nested items form a tree.
 */
export type ItemNode<T = unknown> = {
    /** Stable identifier used to track the item across updates and selection. */
    id: string;
    value: T;
    children?: ItemNode<T>[] | undefined;
    /** Hides the tree expander arrow even when the item has children. */
    hideExpander?: boolean | undefined;
    /** Adds indentation matching the item's depth in the tree. */
    indentForDepth?: boolean | undefined;
    /** Reserves indentation space for an expander icon. */
    indentForIcon?: boolean | undefined;
};

/** A group of items rendered under a shared section header. */
export type SectionNode<S = unknown, T = unknown> = {
    /** Stable identifier used to track the section across updates. */
    id: string;
    value: S;
    /** Items belonging to this section. */
    data: ItemNode<T>[];
};

/** Props passed to a renderItem callback when rendering one cell. */
export type RenderItemProps<T> = {
    item: T;
    index: number;
    /** Depth of the item within a tree, starting at zero for top-level items. */
    depth?: number | undefined;
    /** Whether the item is currently expanded in a tree view. */
    isExpanded?: boolean | undefined;
};

export type CollectionItemSizeProps = {
    estimatedItemHeight?: number | undefined;
    estimatedItemWidth?: number | undefined;
};

export type ControlledSelectionProps = {
    selectedIds?: string[] | null | undefined;
    onSelectionChanged?: ((ids: string[]) => void) | null | undefined;
    selectionMode?: Gtk.SelectionMode | null | undefined;
};

export type ControlledExpansionProps = {
    expandedIds?: string[] | null | undefined;
    onExpandedChange?: ((ids: string[]) => void) | null | undefined;
};

/** Declarative description of a single menu item, optionally nesting a submenu or section. */
export type MenuEntry = {
    /** Text shown for the item. */
    label?: string | undefined;
    /** Action name activated when the item is chosen, for example "app.quit". */
    action?: string | undefined;
    /** Nested entries shown as a submenu opened from this item. */
    submenu?: MenuEntry[] | undefined;
    /** Nested entries grouped as a visually separated section. */
    section?: MenuEntry[] | undefined;
};

export type ColumnDefDeclarativeProps<T = unknown> = {
    title: string;
    expand?: boolean | undefined;
    resizable?: boolean | undefined;
    fixedWidth?: number | undefined;
    id: string;
    sortable?: boolean | undefined;
    visible?: boolean | undefined;
    renderCell: (props: RenderItemProps<T>) => ReactNode;
    headerMenu?: ReactNode;
};

export type ColumnDef<T = unknown> = Omit<GtkColumnViewColumnProps, "factory" | "sorter"> &
    ColumnDefDeclarativeProps<T>;

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

/** Props for {@link ConstraintLayout}. */
export type ConstraintLayoutProps = {
    children?: ReactNode;
    ref?: Ref<Gtk.ConstraintLayout | null>;
};

/**
 * Describes one constraint added by `<ConstraintLayout.Constraint>`, relating a
 * target widget attribute to a source attribute of another widget or guide.
 */
export type ConstraintProps = {
    /** Name of the target widget or guide. Use "super" or omit to reference the layout's own widget. */
    target?: string;
    targetAttribute: Gtk.ConstraintAttribute;
    /** Relation between the target and source attributes (defaults to equality). */
    relation?: Gtk.ConstraintRelation;
    /** Name of the source widget or guide. Use "super" or omit for a constant constraint. */
    source?: string;
    sourceAttribute?: Gtk.ConstraintAttribute;
    /** Factor applied to the source attribute (defaults to 1). */
    multiplier?: number;
    /** Constant offset added to the relation (defaults to 0). */
    constant?: number;
    /** Constraint strength, higher values winning conflicts (defaults to required). */
    strength?: number;
};

/**
 * Describes an invisible spacing guide added by `<ConstraintLayout.Guide>`,
 * usable as a constraint target under its id.
 */
export type ConstraintGuideProps = {
    /** Identifier used to reference this guide from constraints. */
    id: string;
    minWidth?: number;
    minHeight?: number;
    /** Preferred (natural) width. */
    natWidth?: number;
    /** Preferred (natural) height. */
    natHeight?: number;
    maxWidth?: number;
    maxHeight?: number;
    /** Strength of the guide's own size constraints. */
    strength?: Gtk.ConstraintStrength;
};

/**
 * Describes constraints authored with the Visual Format Language (VFL), applied by
 * `<ConstraintLayout.Vfl>`.
 */
export type ConstraintVflProps = {
    /** VFL lines describing the constraints between named widgets and guides. */
    lines: string[];
    /** Default horizontal spacing used by the layout operator (defaults to 0). */
    hspacing?: number;
    /** Default vertical spacing used by the layout operator (defaults to 0). */
    vspacing?: number;
};

export type DropDownItemRenderer<T> = (props: RenderItemProps<T>) => ReactNode;

/** Declarative props for {@link DropDown}'s backing collection and cell rendering. */
export type DropDownDeclarativeProps<T = unknown, S = unknown> = {
    items?: ItemNode<T>[] | undefined;
    sections?: SectionNode<S, T>[] | undefined;
    /** Id of the currently selected item, making the selection controlled. */
    selectedId?: string | null | undefined;
    onSelectionChanged?: ((id: string) => void) | null | undefined;
    renderItem?: DropDownItemRenderer<T> | null | undefined;
    /** Renderer for items in the open popup list, falling back to renderItem when omitted. */
    renderListItem?: DropDownItemRenderer<T> | null | undefined;
    /** Renderer for section headers in the popup list. */
    renderHeader?: ((info: { section: S }) => ReactNode) | null | undefined;
};

/**
 * Props for {@link DropDown}. The backing widget is chosen through the `component` prop, defaulting to
 * GtkDropDown, and its own props combine with {@link DropDownDeclarativeProps}.
 */
export type DropDownProps<T = unknown, S = unknown, C extends ElementType = typeof GtkDropDown> = WidgetProps<
    C,
    DropDownDeclarativeProps<T, S>,
    "model" | "factory" | "listFactory" | "headerFactory"
>;

/** Props for {@link Fixed}. */
export type FixedProps = GtkFixedProps & { ref?: Ref<Gtk.Fixed | null>; children?: ReactNode };

export type FixedPlacementProps = {
    x?: number | null | undefined;
    y?: number | null | undefined;
    /** Full transform applied to the child, overriding x and y when provided. */
    transform?: Gsk.Transform | null | undefined;
};

/** Positions a single child inside a {@link Fixed} at coordinates x and y, or by an explicit transform. */
export type FixedChildProps<C extends ElementType> = ChildProps<C, FixedPlacementProps>;

/** Props for {@link Grid}. */
export type GridProps = GtkGridProps & { ref?: Ref<Gtk.Grid | null>; children?: ReactNode };

export type GridPlacement = {
    column?: number | null | undefined;
    row?: number | null | undefined;
    /** Number of columns the child spans (defaults to 1). */
    columnSpan?: number | null | undefined;
    /** Number of rows the child spans (defaults to 1). */
    rowSpan?: number | null | undefined;
};

/** Places a single child inside a {@link Grid} at a column and row, optionally spanning multiple cells. */
export type GridChildProps<C extends ElementType> = ChildProps<C, GridPlacement>;

export type GridViewDeclarativeProps<T = unknown> = CollectionItemSizeProps &
    ControlledSelectionProps & {
        items?: ItemNode<T>[] | undefined;
        renderItem: (props: RenderItemProps<T>) => ReactNode;
    };

/**
 * Props for {@link GridView}. Combines the underlying Gtk.GridView props with
 * declarative collection props: items, a per-cell renderItem, controlled selection,
 * and estimated item sizing.
 */
export type GridViewProps<T = unknown> = Omit<
    GtkGridViewProps,
    "model" | "factory" | keyof GridViewDeclarativeProps<T>
> &
    GridViewDeclarativeProps<T>;

export type ListViewDeclarativeProps<T = unknown, S = unknown> = CollectionItemSizeProps &
    ControlledSelectionProps &
    ControlledExpansionProps & {
        items?: ItemNode<T>[] | undefined;
        sections?: SectionNode<S, T>[] | undefined;
        renderItem: (props: RenderItemProps<T>) => ReactNode;
        renderHeader?: ((info: { section: S }) => ReactNode) | null | undefined;
    };

/**
 * Props for {@link ListView}. Combines the underlying Gtk.ListView props with
 * declarative collection props: flat items or grouped sections, a per-row renderItem,
 * an optional section header renderer, controlled selection and expansion, and
 * estimated item sizing.
 */
export type ListViewProps<T = unknown, S = unknown> = Omit<
    GtkListViewProps,
    "model" | "factory" | "headerFactory" | keyof ListViewDeclarativeProps<T, S>
> &
    ListViewDeclarativeProps<T, S>;

export type MenuItemsProps = {
    items?: MenuEntry[] | null | undefined;
};

/** Props for {@link Menu}, combining Gio.Menu props with a declarative items array. */
export type MenuProps = Omit<GMenuProps, keyof MenuItemsProps> & MenuItemsProps & { ref?: Ref<Gio.Menu | null> };

/** Props for {@link Overlay}. */
export type OverlayProps = GtkOverlayProps & { ref?: Ref<Gtk.Overlay | null> };

export type OverlayPlacementProps = {
    /** Whether this overlay contributes to the Overlay's measured size. */
    measure?: boolean | null | undefined;
    /** Whether the overlay is clipped to the main child's allocation. */
    clipOverlay?: boolean | null | undefined;
};

/** Adds a single widget as an overlay on top of an {@link Overlay}'s main child. */
export type OverlayChildProps<C extends ElementType> = ChildProps<C, OverlayPlacementProps>;

/** Props for {@link SizeGroup}. */
export type SizeGroupProps = {
    /** How the group equalizes sizes: horizontal, vertical, or both. */
    mode?: Gtk.SizeGroupMode | null | undefined;
    ref?: Ref<Gtk.SizeGroup | null>;
    children?: ReactNode;
};

/** Adds a single widget, rendered by the given component, to the enclosing {@link SizeGroup}. */
export type SizeGroupChildProps<C extends ElementType> = ChildProps<C>;

/** Props for {@link TextPaintable}. */
export type TextPaintableProps = {
    /** The paintable inserted into the enclosing text buffer at this position. */
    paintable: Gdk.Paintable;
    /** Called with the buffer and the position mark right after the paintable is inserted. */
    onInserted?: (buffer: Gtk.TextBuffer, mark: Gtk.TextMark) => void;
};
