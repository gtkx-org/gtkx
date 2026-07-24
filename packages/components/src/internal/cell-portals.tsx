import { createPortal } from "@gtkx/react";
import type { ReactNode } from "react";
import type { RenderItemProps } from "../types.js";
import type { CellRecord, CellTracker } from "./cell-tracker.js";
import type { CollectionViewApi } from "./use-collection-view.js";

export type CellRenderers = {
    item: (record: CellRecord) => ReactNode;
    header: (record: CellRecord) => ReactNode;
};

export const renderCellPortals = (tracker: CellTracker, renderers: CellRenderers): ReactNode[] =>
    tracker
        .values()
        .map((record) => createPortal(renderers[record.kind](record), record.target, `gtkx-cell-${record.key}`));

type RenderItemArgsOptions = {
    record: CellRecord;
    api: CollectionViewApi;
    expandedIds: string[] | null | undefined;
};

export const buildRenderItemArgs = (options: RenderItemArgsOptions): RenderItemProps<unknown> | null => {
    const { record, api, expandedIds } = options;
    const entry = api.source()?.entryOfHolder(record.holder);
    if (entry === undefined) return null;
    const args: RenderItemProps<unknown> = { item: entry.node.value, index: record.position() };
    if (record.row !== null) {
        args.depth = record.row.getDepth();
        if (record.row.isExpandable()) {
            args.isExpanded = expandedIds != null ? expandedIds.includes(entry.id) : record.row.getExpanded();
        }
    }
    return args;
};

export const headerSectionValue = (record: CellRecord, api: CollectionViewApi): unknown =>
    api.source()?.entryOfHolder(record.holder)?.sectionValue;

type ItemContentOptions = {
    api: CollectionViewApi;
    expandedIds: string[] | null | undefined;
    render: (args: RenderItemProps<unknown>) => ReactNode;
};

export const itemContentRenderer =
    (options: ItemContentOptions): ((record: CellRecord) => ReactNode) =>
    (record) => {
        const args = buildRenderItemArgs({ record, api: options.api, expandedIds: options.expandedIds });
        return args === null ? null : options.render(args);
    };

export const asHeaderRenderer = (
    renderHeader: unknown,
    api: CollectionViewApi,
): ((record: CellRecord) => ReactNode) => {
    if (typeof renderHeader !== "function") return () => null;
    const render = renderHeader as (info: { section: unknown }) => ReactNode;
    return (record) => render({ section: headerSectionValue(record, api) });
};

type CollectionPortalOptions<T> = {
    harness: { tracker: CellTracker };
    view: { api: CollectionViewApi };
    renderItem: (args: RenderItemProps<T>) => ReactNode;
    renderHeader?: unknown;
    expandedIds?: string[] | null | undefined;
};

export function collectionPortals<T>(options: CollectionPortalOptions<T>): ReactNode[] {
    const { harness, view, expandedIds } = options;
    return renderCellPortals(harness.tracker, {
        item: itemContentRenderer({
            api: view.api,
            expandedIds,
            render: options.renderItem as (args: RenderItemProps<unknown>) => ReactNode,
        }),
        header: asHeaderRenderer(options.renderHeader, view.api),
    });
}
