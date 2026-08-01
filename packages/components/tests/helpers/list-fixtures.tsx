import type * as Gtk from "@gtkx/gi/gtk";
import {
    ColumnView,
    type ColumnViewColumn,
    GridView,
    type ListItem,
    type ListItemRenderer,
    ListView,
} from "@gtkx/components";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { render as testingRender } from "@gtkx/testing";
import { createRef, type ReactNode, type RefObject } from "react";
import { ScrollWrapper } from "./scroll-wrapper.js";

type FixtureRender = (element: ReactNode) => Promise<{ rerender: (element: ReactNode) => Promise<void> }>;

type NamedValue = {
    name: string;
};

type FixtureInput<T> = string[] | ListItem<T>[];

type ListViewFixtureOptions = {
    selected?: string[];
    selectionMode?: Gtk.SelectionMode;
    onSelectionChanged?: (ids: string[]) => void;
    estimatedItemHeight?: number;
    minContentHeight?: number;
    maxContentHeight?: number;
    minContentWidth?: number;
};

type RenderListViewOptions<T> = ListViewFixtureOptions & {
    renderItem?: ListItemRenderer<T>;
    expandedIds?: string[];
    onExpandedChange?: (ids: string[]) => void;
    shouldExpandAll?: boolean;
};

type RenderGridViewOptions<T> = ListViewFixtureOptions & {
    renderItem?: ListItemRenderer<T>;
    singleClickActivate?: boolean;
};

type ListViewFixture<T> = {
    ref: RefObject<Gtk.ListView>;
    rerender: (items: FixtureInput<T>, options?: RenderListViewOptions<T>) => Promise<void>;
};

type GridViewFixture<T> = {
    ref: RefObject<Gtk.GridView>;
    rerender: (items: FixtureInput<T>, options?: RenderGridViewOptions<T>) => Promise<void>;
};

type ContentSizing = {
    minContentHeight?: number | undefined;
    maxContentHeight?: number | undefined;
    minContentWidth?: number | undefined;
};

type RenderColumnViewOptions<T> = {
    columns?: ColumnViewColumn<T>[];
    selected?: string[];
    selectionMode?: Gtk.SelectionMode;
    onSelectionChanged?: (ids: string[]) => void;
    expandedIds?: string[];
    onExpandedChange?: (ids: string[]) => void;
    shouldExpandAll?: boolean;
    sortColumn?: string | null;
    sortOrder?: Gtk.SortType;
    onSortChanged?: (column: string | null, order: Gtk.SortType) => void;
    minContentHeight?: number;
    minContentWidth?: number;
};

type ColumnViewFixture<T> = {
    ref: RefObject<Gtk.ColumnView>;
    rerender: (items: FixtureInput<T>, options?: RenderColumnViewOptions<T>) => Promise<void>;
};

const firstSecondItems: ListItem<NamedValue>[] = [
    { id: "1", value: { name: "First" } },
    { id: "2", value: { name: "Second" } },
];

const firstSecondThirdItems: ListItem<NamedValue>[] = [...firstSecondItems, { id: "3", value: { name: "Third" } }];

const valueItems = (values: string[]): { id: string; value: string }[] =>
    values.map((value, index) => ({ id: String(index + 1), value }));

const toListItems = <T,>(items: FixtureInput<T>): ListItem<T>[] =>
    items.length > 0 && typeof items[0] === "string"
        ? (items as string[]).map((id) => ({ id, value: { name: id } as T }))
        : (items as ListItem<T>[]);

const collectExpandableIds = <T,>(list: ListItem<T>[], ids: string[]): void => {
    for (const item of list) {
        if (item.children === undefined || item.children.length === 0) {
            continue;
        }

        ids.push(item.id);
        collectExpandableIds(item.children, ids);
    }
};

const allExpandableIds = <T,>(items: ListItem<T>[]): string[] => {
    const ids: string[] = [];
    collectExpandableIds(items, ids);

    return ids;
};

const renderNamed = ({ item }: { item: unknown }): ReactNode => <GtkLabel>{(item as NamedValue).name}</GtkLabel>;

const withScrollWrapper = (sizing: ContentSizing, view: ReactNode): ReactNode => (
    <ScrollWrapper
        minContentHeight={sizing.minContentHeight}
        maxContentHeight={sizing.maxContentHeight}
        minContentWidth={sizing.minContentWidth}
    >
        {view}
    </ScrollWrapper>
);

const wireFixture = async <W, T, O extends object>(config: {
    ref: RefObject<W | null>;
    draw: (data: FixtureInput<T>, opts: O) => ReactNode;
    items: FixtureInput<T>;
    options: O;
    render: FixtureRender;
}): Promise<{ ref: RefObject<W>; rerender: (items: FixtureInput<T>, options?: O) => Promise<void> }> => {
    const { ref, draw, items, options, render } = config;
    const { rerender } = await render(draw(items, options));

    return {
        ref: ref as RefObject<W>,
        rerender: async (nextItems, nextOptions) => {
            await rerender(draw(nextItems, { ...options, ...nextOptions }));
        },
    };
};

const renderListView = async <T = NamedValue>(
    items: FixtureInput<T>,
    options: RenderListViewOptions<T> = {},
    render: FixtureRender = testingRender,
): Promise<ListViewFixture<T>> => {
    const ref = createRef<Gtk.ListView>();

    const draw = (data: FixtureInput<T>, opts: RenderListViewOptions<T>): ReactNode => {
        const { renderItem = renderNamed } = opts;
        const expandedIds = opts.shouldExpandAll ? allExpandableIds(toListItems(data)) : opts.expandedIds;

        return withScrollWrapper(
            opts,
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
            />,
        );
    };

    return wireFixture({ ref, draw, items, options, render });
};

const renderGridView = async <T = NamedValue>(
    items: FixtureInput<T>,
    options: RenderGridViewOptions<T> = {},
    render: FixtureRender = testingRender,
): Promise<GridViewFixture<T>> => {
    const ref = createRef<Gtk.GridView>();

    return wireFixture({
        ref,
        items,
        options,
        render,
        draw: (data, opts) => {
            const { renderItem = renderNamed } = opts;

            return withScrollWrapper(
                opts,
                <GridView
                    ref={ref}
                    items={toListItems(data)}
                    renderItem={renderItem}
                    selectedIds={opts.selected}
                    selectionMode={opts.selectionMode}
                    onSelectionChanged={opts.onSelectionChanged}
                    estimatedItemHeight={opts.estimatedItemHeight}
                    singleClickActivate={opts.singleClickActivate}
                />,
            );
        },
    });
};

const renderColumnView = async <T = NamedValue>(
    items: FixtureInput<T>,
    options: RenderColumnViewOptions<T> = {},
    render: FixtureRender = testingRender,
): Promise<ColumnViewFixture<T>> => {
    const ref = createRef<Gtk.ColumnView>();
    const defaultColumns: ColumnViewColumn<T>[] = [{ id: "name", title: "Name", renderCell: renderNamed }];

    const draw = (data: FixtureInput<T>, opts: RenderColumnViewOptions<T>): ReactNode => {
        const { columns = defaultColumns } = opts;
        const expandedIds = opts.shouldExpandAll ? allExpandableIds(toListItems(data)) : opts.expandedIds;

        return withScrollWrapper(
            { minContentHeight: opts.minContentHeight ?? 500, minContentWidth: opts.minContentWidth },
            <ColumnView
                ref={ref}
                items={toListItems(data)}
                columns={columns.map((column) => ({ expand: true, ...column }))}
                selectedIds={opts.selected}
                selectionMode={opts.selectionMode}
                onSelectionChanged={opts.onSelectionChanged}
                expandedIds={expandedIds}
                onExpandedChange={opts.onExpandedChange}
                sortColumn={opts.sortColumn}
                sortOrder={opts.sortOrder}
                onSortChanged={opts.onSortChanged}
            />,
        );
    };

    return wireFixture({ ref, draw, items, options, render });
};

export type { ColumnViewColumn } from "@gtkx/components";
export {
    valueItems,
    firstSecondItems,
    firstSecondThirdItems,
    allExpandableIds,
    renderListView,
    renderGridView,
    renderColumnView,
    type FixtureRender,
    type NamedValue,
    type FixtureInput,
    type RenderListViewOptions,
    type RenderGridViewOptions,
    type ListViewFixture,
    type GridViewFixture,
    type RenderColumnViewOptions,
    type ColumnViewFixture,
};
