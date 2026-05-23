import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkColumnView, GtkGridView, GtkLabel, GtkListView, type ListItem } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef, type ReactNode, type RefObject } from "react";
import { ScrollWrapper } from "./scroll-wrapper.js";

/** Default item value shape produced when a fixture is given plain string ids. */
export interface NamedValue {
    name: string;
}

/**
 * Items accepted by every list/grid/column fixture: either plain string ids
 * (each mapped to `{ id, value: { name: id } }`) or fully-shaped list items.
 */
export type FixtureInput<T> = string[] | ListItem<T>[];

const toListItems = <T,>(items: FixtureInput<T>): ListItem<T>[] =>
    items.length > 0 && typeof items[0] === "string"
        ? (items as string[]).map((id) => ({ id, value: { name: id } as T }))
        : (items as ListItem<T>[]);

const renderNamed = (item: unknown): ReactNode => <GtkLabel label={(item as NamedValue).name} />;

/** Options shared by the list-view and grid-view fixtures. */
export interface ListViewFixtureOptions<T> {
    /** Renders a single item; defaults to a `GtkLabel` bound to `value.name`. */
    renderItem?: (item: T, row?: Gtk.TreeListRow | null) => ReactNode;
    /** Selected item ids. */
    selected?: string[];
    /** Selection behavior. */
    selectionMode?: Gtk.SelectionMode;
    /** Fired when the selection changes. */
    onSelectionChanged?: (ids: string[]) => void;
    /** Estimated item height in pixels for virtualization. */
    estimatedItemHeight?: number;
    /** Minimum scroll-content height in pixels (default 200). */
    minContentHeight?: number;
    /** Maximum scroll-content height in pixels. */
    maxContentHeight?: number;
    /** Minimum scroll-content width in pixels (default 200). */
    minContentWidth?: number;
}

/** Options accepted by {@link renderListView}, adding tree-mode expansion. */
export interface RenderListViewOptions<T> extends ListViewFixtureOptions<T> {
    /** Whether tree rows expand automatically. */
    autoexpand?: boolean;
}

/** Options accepted by {@link renderGridView}. */
export interface RenderGridViewOptions<T> extends ListViewFixtureOptions<T> {
    /** Whether a single click activates an item. */
    singleClickActivate?: boolean;
}

/** Handle returned by {@link renderListView}. */
export interface ListViewFixture<T> {
    /** Ref to the rendered `GtkListView`. */
    ref: RefObject<Gtk.ListView>;
    /** Re-renders the list with new items, merging in any new options. */
    rerender: (items: FixtureInput<T>, options?: RenderListViewOptions<T>) => Promise<void>;
}

/** Handle returned by {@link renderGridView}. */
export interface GridViewFixture<T> {
    /** Ref to the rendered `GtkGridView`. */
    ref: RefObject<Gtk.GridView>;
    /** Re-renders the grid with new items, merging in any new options. */
    rerender: (items: FixtureInput<T>, options?: RenderGridViewOptions<T>) => Promise<void>;
}

/**
 * Renders a `GtkListView` of the given items inside a sized scroll container.
 *
 * @typeParam T - Item value type; defaults to {@link NamedValue} for string ids.
 */
export const renderListView = async <T = NamedValue>(
    items: FixtureInput<T>,
    options: RenderListViewOptions<T> = {},
): Promise<ListViewFixture<T>> => {
    const ref = createRef<Gtk.ListView>();
    const draw = (data: FixtureInput<T>, opts: RenderListViewOptions<T>): ReactNode => {
        const { renderItem = renderNamed, minContentHeight, maxContentHeight, minContentWidth } = opts;
        return (
            <ScrollWrapper
                minContentHeight={minContentHeight}
                maxContentHeight={maxContentHeight}
                minContentWidth={minContentWidth}
            >
                <GtkListView
                    ref={ref}
                    items={toListItems(data)}
                    renderItem={renderItem}
                    autoexpand={opts.autoexpand}
                    selected={opts.selected}
                    selectionMode={opts.selectionMode}
                    onSelectionChanged={opts.onSelectionChanged}
                    estimatedItemHeight={opts.estimatedItemHeight}
                />
            </ScrollWrapper>
        );
    };
    await render(draw(items, options));
    return {
        ref: ref as RefObject<Gtk.ListView>,
        rerender: async (nextItems, nextOptions) => {
            await render(draw(nextItems, { ...options, ...nextOptions }));
        },
    };
};

/**
 * Renders a `GtkGridView` of the given items inside a sized scroll container.
 *
 * @typeParam T - Item value type; defaults to {@link NamedValue} for string ids.
 */
export const renderGridView = async <T = NamedValue>(
    items: FixtureInput<T>,
    options: RenderGridViewOptions<T> = {},
): Promise<GridViewFixture<T>> => {
    const ref = createRef<Gtk.GridView>();
    const draw = (data: FixtureInput<T>, opts: RenderGridViewOptions<T>): ReactNode => {
        const { renderItem = renderNamed, minContentHeight, maxContentHeight, minContentWidth } = opts;
        return (
            <ScrollWrapper
                minContentHeight={minContentHeight}
                maxContentHeight={maxContentHeight}
                minContentWidth={minContentWidth}
            >
                <GtkGridView
                    ref={ref}
                    items={toListItems(data)}
                    renderItem={renderItem}
                    selected={opts.selected}
                    selectionMode={opts.selectionMode}
                    onSelectionChanged={opts.onSelectionChanged}
                    estimatedItemHeight={opts.estimatedItemHeight}
                    singleClickActivate={opts.singleClickActivate}
                />
            </ScrollWrapper>
        );
    };
    await render(draw(items, options));
    return {
        ref: ref as RefObject<Gtk.GridView>,
        rerender: async (nextItems, nextOptions) => {
            await render(draw(nextItems, { ...options, ...nextOptions }));
        },
    };
};

/** Definition of one `GtkColumnView` column. */
export interface ColumnDef<T> {
    /** Unique column id. */
    id: string;
    /** Column header text. */
    title: string;
    /** Renders one cell of this column. */
    renderCell: (item: T) => ReactNode;
    /** Whether the column expands to fill available space (default true). */
    expand?: boolean;
    /** Whether the header is clickable to sort. */
    sortable?: boolean;
    /** Fixed width in pixels. */
    fixedWidth?: number;
}

/** Options accepted by {@link renderColumnView}. */
export interface RenderColumnViewOptions<T> {
    /** Column definitions; defaults to a single expanding "Name" column. */
    columns?: ColumnDef<T>[];
    /** Selected row ids. */
    selected?: string[];
    /** Selection behavior. */
    selectionMode?: Gtk.SelectionMode;
    /** Fired when the selection changes. */
    onSelectionChanged?: (ids: string[]) => void;
    /** Id of the sorted column, or null for no sorting. */
    sortColumn?: string | null;
    /** Sort direction. */
    sortOrder?: Gtk.SortType;
    /** Fired when the sort column or order changes. */
    onSortChanged?: (column: string | null, order: Gtk.SortType) => void;
    /** Minimum scroll-content height in pixels (default 500). */
    minContentHeight?: number;
    /** Minimum scroll-content width in pixels (default 200). */
    minContentWidth?: number;
}

/** Handle returned by {@link renderColumnView}. */
export interface ColumnViewFixture<T> {
    /** Ref to the rendered `GtkColumnView`. */
    ref: RefObject<Gtk.ColumnView>;
    /** Re-renders the column view with new items, merging in any new options. */
    rerender: (items: FixtureInput<T>, options?: RenderColumnViewOptions<T>) => Promise<void>;
}

/**
 * Renders a `GtkColumnView` of the given items inside a sized scroll container.
 *
 * @typeParam T - Row value type; defaults to {@link NamedValue} for string ids.
 */
export const renderColumnView = async <T = NamedValue>(
    items: FixtureInput<T>,
    options: RenderColumnViewOptions<T> = {},
): Promise<ColumnViewFixture<T>> => {
    const ref = createRef<Gtk.ColumnView>();
    const defaultColumns: ColumnDef<T>[] = [{ id: "name", title: "Name", renderCell: renderNamed }];
    const draw = (data: FixtureInput<T>, opts: RenderColumnViewOptions<T>): ReactNode => {
        const { columns = defaultColumns, minContentHeight = 500, minContentWidth } = opts;
        return (
            <ScrollWrapper minContentHeight={minContentHeight} minContentWidth={minContentWidth}>
                <GtkColumnView
                    ref={ref}
                    items={toListItems(data)}
                    selected={opts.selected}
                    selectionMode={opts.selectionMode}
                    onSelectionChanged={opts.onSelectionChanged}
                    sortColumn={opts.sortColumn}
                    sortOrder={opts.sortOrder}
                    onSortChanged={opts.onSortChanged}
                >
                    {columns.map((column) => (
                        <GtkColumnView.Column
                            key={column.id}
                            id={column.id}
                            title={column.title}
                            expand={column.expand ?? true}
                            sortable={column.sortable}
                            fixedWidth={column.fixedWidth}
                            renderCell={column.renderCell}
                        />
                    ))}
                </GtkColumnView>
            </ScrollWrapper>
        );
    };
    await render(draw(items, options));
    return {
        ref: ref as RefObject<Gtk.ColumnView>,
        rerender: async (nextItems, nextOptions) => {
            await render(draw(nextItems, { ...options, ...nextOptions }));
        },
    };
};
