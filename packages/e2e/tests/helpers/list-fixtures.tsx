import {
    ColumnView,
    ColumnViewColumn,
    GridView,
    type ItemNode,
    ListView,
    type RenderItemProps,
} from "@gtkx/components";
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";

import { render as testingRender } from "@gtkx/testing";
import { createRef, type ReactNode, type RefObject } from "react";
import { ScrollWrapper } from "./scroll-wrapper.js";

export type FixtureRender = (element: ReactNode) => Promise<{ rerender: (element: ReactNode) => Promise<void> }>;

export interface NamedValue {
    name: string;
}

export const valueItems = (values: string[]): Array<{ id: string; value: string }> =>
    values.map((value, index) => ({ id: String(index + 1), value }));

export type FixtureInput<T> = string[] | ItemNode<T>[];

const toListItems = <T,>(items: FixtureInput<T>): ItemNode<T>[] =>
    items.length > 0 && typeof items[0] === "string"
        ? (items as string[]).map((id) => ({ id, value: { name: id } as T }))
        : (items as ItemNode<T>[]);

export const allExpandableIds = <T,>(items: ItemNode<T>[]): string[] => {
    const ids: string[] = [];
    const walk = (list: ItemNode<T>[]): void => {
        for (const item of list) {
            if (item.children !== undefined && item.children.length > 0) {
                ids.push(item.id);
                walk(item.children);
            }
        }
    };
    walk(items);
    return ids;
};

const renderNamed = ({ item }: { item: unknown }): ReactNode => <GtkLabel label={(item as NamedValue).name} />;

type ListViewFixtureOptions = {
    selected?: string[];
    selectionMode?: Gtk.SelectionMode;
    onSelectionChanged?: (ids: string[]) => void;
    estimatedItemHeight?: number;
    minContentHeight?: number;
    maxContentHeight?: number;
    minContentWidth?: number;
};

export type RenderListViewOptions<T> = ListViewFixtureOptions & {
    renderItem?: (props: RenderItemProps<T>) => ReactNode;
    expandedIds?: string[];
    onExpandedChange?: (ids: string[]) => void;
    expandAll?: boolean;
};

export type RenderGridViewOptions<T> = ListViewFixtureOptions & {
    renderItem?: (props: RenderItemProps<T>) => ReactNode;
    singleClickActivate?: boolean;
};

export interface ListViewFixture<T> {
    ref: RefObject<Gtk.ListView>;
    rerender: (items: FixtureInput<T>, options?: RenderListViewOptions<T>) => Promise<void>;
}

export interface GridViewFixture<T> {
    ref: RefObject<Gtk.GridView>;
    rerender: (items: FixtureInput<T>, options?: RenderGridViewOptions<T>) => Promise<void>;
}

export const renderListView = async <T = NamedValue>(
    items: FixtureInput<T>,
    options: RenderListViewOptions<T> = {},
    render: FixtureRender = testingRender,
): Promise<ListViewFixture<T>> => {
    const ref = createRef<Gtk.ListView>();
    const draw = (data: FixtureInput<T>, opts: RenderListViewOptions<T>): ReactNode => {
        const { renderItem = renderNamed, minContentHeight, maxContentHeight, minContentWidth } = opts;
        const expandedIds = opts.expandAll ? allExpandableIds(toListItems(data)) : opts.expandedIds;
        return (
            <ScrollWrapper
                minContentHeight={minContentHeight}
                maxContentHeight={maxContentHeight}
                minContentWidth={minContentWidth}
            >
                <ListView
                    ref={ref}
                    items={toListItems(data)}
                    renderItem={renderItem}
                    expandedIds={expandedIds}
                    onExpandedChange={opts.onExpandedChange}
                    selectedIds={opts.selected}
                    selectionMode={opts.selectionMode}
                    onSelectionChanged={opts.onSelectionChanged}
                    estimatedItemHeight={opts.estimatedItemHeight}
                />
            </ScrollWrapper>
        );
    };
    const { rerender } = await render(draw(items, options));
    return {
        ref: ref as RefObject<Gtk.ListView>,
        rerender: async (nextItems, nextOptions) => {
            await rerender(draw(nextItems, { ...options, ...nextOptions }));
        },
    };
};

export const renderGridView = async <T = NamedValue>(
    items: FixtureInput<T>,
    options: RenderGridViewOptions<T> = {},
    render: FixtureRender = testingRender,
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
                <GridView
                    ref={ref}
                    items={toListItems(data)}
                    renderItem={renderItem}
                    selectedIds={opts.selected}
                    selectionMode={opts.selectionMode}
                    onSelectionChanged={opts.onSelectionChanged}
                    estimatedItemHeight={opts.estimatedItemHeight}
                    singleClickActivate={opts.singleClickActivate}
                />
            </ScrollWrapper>
        );
    };
    const { rerender } = await render(draw(items, options));
    return {
        ref: ref as RefObject<Gtk.GridView>,
        rerender: async (nextItems, nextOptions) => {
            await rerender(draw(nextItems, { ...options, ...nextOptions }));
        },
    };
};

export interface ColumnDef<T> {
    id: string;
    title: string;
    renderItem: (props: RenderItemProps<T>) => ReactNode;
    expand?: boolean;
    sortable?: boolean;
    fixedWidth?: number;
}

export type RenderColumnViewOptions<T> = {
    columns?: ColumnDef<T>[];
    selected?: string[];
    selectionMode?: Gtk.SelectionMode;
    onSelectionChanged?: (ids: string[]) => void;
    expandedIds?: string[];
    onExpandedChange?: (ids: string[]) => void;
    expandAll?: boolean;
    sortColumn?: string | null;
    sortOrder?: Gtk.SortType;
    onSortChanged?: (column: string | null, order: Gtk.SortType) => void;
    minContentHeight?: number;
    minContentWidth?: number;
};

export interface ColumnViewFixture<T> {
    ref: RefObject<Gtk.ColumnView>;
    rerender: (items: FixtureInput<T>, options?: RenderColumnViewOptions<T>) => Promise<void>;
}

export const renderColumnView = async <T = NamedValue>(
    items: FixtureInput<T>,
    options: RenderColumnViewOptions<T> = {},
    render: FixtureRender = testingRender,
): Promise<ColumnViewFixture<T>> => {
    const ref = createRef<Gtk.ColumnView>();
    const defaultColumns: ColumnDef<T>[] = [{ id: "name", title: "Name", renderItem: renderNamed }];
    const draw = (data: FixtureInput<T>, opts: RenderColumnViewOptions<T>): ReactNode => {
        const { columns = defaultColumns, minContentHeight = 500, minContentWidth } = opts;
        const expandedIds = opts.expandAll ? allExpandableIds(toListItems(data)) : opts.expandedIds;
        return (
            <ScrollWrapper minContentHeight={minContentHeight} minContentWidth={minContentWidth}>
                <ColumnView
                    ref={ref}
                    items={toListItems(data)}
                    selectedIds={opts.selected}
                    selectionMode={opts.selectionMode}
                    onSelectionChanged={opts.onSelectionChanged}
                    expandedIds={expandedIds}
                    onExpandedChange={opts.onExpandedChange}
                    sortColumn={opts.sortColumn}
                    sortOrder={opts.sortOrder}
                    onSortChanged={opts.onSortChanged}
                >
                    {columns.map((column) => (
                        <ColumnViewColumn
                            key={column.id}
                            id={column.id}
                            title={column.title}
                            expand={column.expand ?? true}
                            sortable={column.sortable}
                            fixedWidth={column.fixedWidth}
                            renderItem={column.renderItem}
                        />
                    ))}
                </ColumnView>
            </ScrollWrapper>
        );
    };
    const { rerender } = await render(draw(items, options));
    return {
        ref: ref as RefObject<Gtk.ColumnView>,
        rerender: async (nextItems, nextOptions) => {
            await rerender(draw(nextItems, { ...options, ...nextOptions }));
        },
    };
};
