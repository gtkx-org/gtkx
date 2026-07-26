import type * as Gdk from "@gtkx/gi/gdk";
import type * as Gtk from "@gtkx/gi/gtk";
import type {
    GtkColumnViewColumnProps,
    GtkColumnViewProps,
    GtkDropDown,
    GtkGridViewProps,
    GtkListViewProps,
} from "@gtkx/jsx/gtk";
import type { ComponentPropsWithRef, ElementType, ReactNode, Ref } from "react";

/** Props of a container's Child component: the widget to render and its own props. */
type ChildProps<C extends ElementType> = {
    component: C;
} & ComponentPropsWithRef<C>;

/** Props of a component whose backing widget defaults to one type but can be swapped through `component`. */
type WidgetProps<C extends ElementType, Own = unknown, ExtraOmit extends string = never> = Own & {
    component?: C;
} & Omit<ComponentPropsWithRef<C>, ExtraOmit | keyof Own>;

/**
 * A single item in a collection model, identified by a stable id and holding an
 * arbitrary value. Nested items form a tree.
 */
type Item<T = unknown> = {
    /** Stable identifier used to track the item across updates and selection. */
    id: string;
    value: T;
    children?: Item<T>[] | undefined;
    /** Hides the tree expander arrow even when the item has children. */
    hideExpander?: boolean | undefined;
    /** Adds indentation matching the item's depth in the tree. */
    indentForDepth?: boolean | undefined;
    /** Reserves indentation space for an expander icon. */
    indentForIcon?: boolean | undefined;
};

/** A group of items rendered under a shared section header. */
type Section<S = unknown, T = unknown> = {
    /** Stable identifier used to track the section across updates. */
    id: string;
    value: S;
    /** Items belonging to this section. */
    data: Item<T>[];
};

/** Arguments passed to an {@link ItemRenderer} when rendering one cell. */
type RenderItemArgs<T> = {
    item: T;
    index: number;
    /** Depth of the item within a tree, starting at zero for top-level items. */
    depth?: number | undefined;
    /** Whether the item is currently expanded in a tree view. */
    isExpanded?: boolean | undefined;
};

/** Arguments passed to a {@link HeaderRenderer} when rendering one section header. */
type RenderHeaderArgs<S> = {
    section: S;
};

/** Renders the contents of one cell of a collection view. */
type ItemRenderer<T> = (args: RenderItemArgs<T>) => ReactNode;
/** Renders the contents of one section header of a collection view. */
type HeaderRenderer<S> = (args: RenderHeaderArgs<S>) => ReactNode;

type ItemSizeProps = {
    estimatedItemHeight?: number | undefined;
    estimatedItemWidth?: number | undefined;
};

type SelectionProps = {
    selectedIds?: string[] | null | undefined;
    onSelectionChanged?: ((ids: string[]) => void) | null | undefined;
    selectionMode?: Gtk.SelectionMode | null | undefined;
};

type ExpansionProps = {
    expandedIds?: string[] | null | undefined;
    onExpandedChange?: ((ids: string[]) => void) | null | undefined;
};

type SourceProps<T, S> = {
    items?: Item<T>[] | undefined;
    sections?: Section<S, T>[] | undefined;
};

/** One column of a {@link ColumnView}, pairing Gtk.ColumnViewColumn props with a cell renderer. */
type Column<T = unknown> = Omit<GtkColumnViewColumnProps, "factory" | "sorter" | "id" | "title"> & {
    /** Stable identifier, also used to address the column through sorting props. */
    id: string;
    title: string;
    renderCell: ItemRenderer<T>;
    /** Whether clicking the column header sorts by it. */
    sortable?: boolean | undefined;
    headerMenu?: ReactNode;
};

type ColumnViewOwnProps<T, S> = SelectionProps &
    ExpansionProps &
    SourceProps<T, S> &
    Omit<ItemSizeProps, "estimatedItemWidth"> & {
        columns: Column<T>[];
        renderHeader?: HeaderRenderer<S> | null | undefined;
        /** Id of the column the view is sorted by, making sorting controlled. */
        sortColumn?: string | null | undefined;
        sortOrder?: Gtk.SortType | null | undefined;
        onSortChanged?: ((column: string | null, order: Gtk.SortType) => void) | null | undefined;
    };

/**
 * Props for {@link ColumnView}. Combines the underlying Gtk.ColumnView props with
 * declarative collection props: flat items or grouped sections, controlled selection
 * and expansion, sorting (sortColumn, sortOrder, onSortChanged), an optional section
 * header renderer, and the columns to render.
 */
type ColumnViewProps<T = unknown, S = unknown> = Omit<
    GtkColumnViewProps,
    "columns" | "model" | "headerFactory" | keyof ColumnViewOwnProps<T, S>
> &
ColumnViewOwnProps<T, S>;

/** Props for {@link ConstraintLayout}. */
type ConstraintLayoutProps = {
    children?: ReactNode;
    ref?: Ref<Gtk.ConstraintLayout | null>;
};

/**
 * Describes one constraint added by `<ConstraintLayout.Constraint>`, relating a
 * target widget attribute to a source attribute of another widget or guide.
 */
type ConstraintProps = {
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
type ConstraintGuideProps = {
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
type ConstraintVflProps = {
    /** VFL lines describing the constraints between named widgets and guides. */
    lines: string[];
    /** Default horizontal spacing used by the layout operator (defaults to 0). */
    hspacing?: number;
    /** Default vertical spacing used by the layout operator (defaults to 0). */
    vspacing?: number;
};

type DropDownOwnProps<T, S> = SourceProps<T, S> & {
    /** Id of the currently selected item, making the selection controlled. */
    selectedId?: string | null | undefined;
    onSelectionChanged?: ((id: string) => void) | null | undefined;
    renderItem?: ItemRenderer<T> | null | undefined;
    /** Renderer for items in the open popup list, falling back to renderItem when omitted. */
    renderListItem?: ItemRenderer<T> | null | undefined;
    /** Renderer for section headers in the popup list. */
    renderHeader?: HeaderRenderer<S> | null | undefined;
};

/**
 * Props for {@link DropDown}. The backing widget is chosen through the `component` prop, defaulting to
 * GtkDropDown, and its own props combine with the declarative collection props.
 */
type DropDownProps<T = unknown, S = unknown, C extends ElementType = typeof GtkDropDown> = WidgetProps<
    C,
    DropDownOwnProps<T, S>,
    "model" | "factory" | "listFactory" | "headerFactory"
>;

type GridViewOwnProps<T> = ItemSizeProps &
    SelectionProps & {
        items?: Item<T>[] | undefined;
        renderItem: ItemRenderer<T>;
    };

/**
 * Props for {@link GridView}. Combines the underlying Gtk.GridView props with
 * declarative collection props: items, a per-cell renderItem, controlled selection,
 * and estimated item sizing.
 */
type GridViewProps<T = unknown> = Omit<GtkGridViewProps, "model" | "factory" | keyof GridViewOwnProps<T>> &
    GridViewOwnProps<T>;

type ListViewOwnProps<T, S> = ItemSizeProps &
    SelectionProps &
    ExpansionProps &
    SourceProps<T, S> & {
        renderItem: ItemRenderer<T>;
        renderHeader?: HeaderRenderer<S> | null | undefined;
    };

/**
 * Props for {@link ListView}. Combines the underlying Gtk.ListView props with
 * declarative collection props: flat items or grouped sections, a per-row renderItem,
 * an optional section header renderer, controlled selection and expansion, and
 * estimated item sizing.
 */
type ListViewProps<T = unknown, S = unknown> = Omit<
    GtkListViewProps,
    "model" | "factory" | "headerFactory" | keyof ListViewOwnProps<T, S>
> &
ListViewOwnProps<T, S>;

/** Props for {@link SizeGroup}. */
type SizeGroupProps = {
    /** How the group equalizes sizes: horizontal, vertical, or both. */
    mode?: Gtk.SizeGroupMode | null | undefined;
    ref?: Ref<Gtk.SizeGroup | null>;
    children?: ReactNode;
};

/** Adds a single widget, rendered by the given component, to the enclosing {@link SizeGroup}. */
type SizeGroupChildProps<C extends ElementType> = ChildProps<C>;

/** Props for {@link TextPaintable}. */
type TextPaintableProps = {
    /** The paintable inserted into the enclosing text buffer at this position. */
    paintable: Gdk.Paintable;
    /** Called with the buffer and the position mark right after the paintable is inserted. */
    onInserted?: (buffer: Gtk.TextBuffer, mark: Gtk.TextMark) => void;
};

export {
    type ChildProps,
    type WidgetProps,
    type Item,
    type Section,
    type RenderItemArgs,
    type RenderHeaderArgs,
    type ItemRenderer,
    type HeaderRenderer,
    type Column,
    type ColumnViewProps,
    type ConstraintLayoutProps,
    type ConstraintProps,
    type ConstraintGuideProps,
    type ConstraintVflProps,
    type DropDownProps,
    type GridViewProps,
    type ListViewProps,
    type SizeGroupProps,
    type SizeGroupChildProps,
    type TextPaintableProps,
};
