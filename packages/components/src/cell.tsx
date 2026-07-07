import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkTreeExpander } from "@gtkx/jsx/gtk";
import { createPortal } from "@gtkx/react";
import { Fragment, memo, type ReactNode, useCallback, useSyncExternalStore } from "react";
import type { RenderItemProps } from "./types.js";
import type { CellContainerStore, CellEntry } from "./utils/cell-container-store.js";
import type { ItemResolver } from "./utils/item-resolver.js";
import type { TreeItemMetadata } from "./utils/list-item-flatten.js";

export type CellRenderer<T, S> = (
    value: T | S | undefined,
    treeRow: Gtk.TreeListRow | null,
    position: number,
) => ReactNode;

interface CellProps<T, S> {
    container: GObject.Object;
    store: CellContainerStore;
    resolver: ItemResolver<T, S>;
    render: CellRenderer<T, S>;
}

interface CellRenderHostProps<T, S> {
    store: CellContainerStore;
    resolver: ItemResolver<T, S>;
    render: CellRenderer<T, S>;
}

interface TreeExpanderCellProps {
    treeRow: Gtk.TreeListRow;
    metadata: TreeItemMetadata;
    children: ReactNode;
}

const TreeExpanderCell = ({ treeRow, metadata, children }: TreeExpanderCellProps): ReactNode => (
    <GtkTreeExpander
        ref={(expander: Gtk.TreeExpander | null) => {
            if (expander !== null) expander.setListRow(treeRow);
        }}
        hideExpander={metadata.hideExpander}
        indentForDepth={metadata.indentForDepth}
        indentForIcon={metadata.indentForIcon}
    >
        {children}
    </GtkTreeExpander>
);

const Cell = memo(<T, S>({ container, store, resolver, render }: CellProps<T, S>): ReactNode => {
    const subscribe = useCallback(
        (onChange: () => void) => store.subscribePosition(container, onChange),
        [store, container],
    );
    const getSnapshot = useCallback((): CellEntry => store.getPosition(container), [store, container]);
    const entry = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    if (entry.position < 0) return null;
    const resolved = resolver.resolve(entry.position, entry.treeRow);
    if (!resolved.present) return null;
    const content = render(resolved.value, entry.treeRow, entry.position);
    const portalled =
        entry.treeRow !== null && !resolved.isHeader ? (
            <TreeExpanderCell treeRow={entry.treeRow} metadata={resolved.metadata}>
                {content}
            </TreeExpanderCell>
        ) : (
            content
        );
    return createPortal(portalled, container, store.keyFor(container));
}) as <T, S>(props: CellProps<T, S>) => ReactNode;

export const CellRenderHost = <T, S>({ store, resolver, render }: CellRenderHostProps<T, S>): ReactNode => {
    const containers = useSyncExternalStore(
        store.subscribeSet,
        store.getContainersSnapshot,
        store.getContainersSnapshot,
    );
    return (
        <Fragment>
            {containers.map((container) => (
                <Cell
                    key={store.keyFor(container)}
                    container={container}
                    store={store}
                    resolver={resolver}
                    render={render}
                />
            ))}
        </Fragment>
    );
};

export type TreeRenderContext = {
    controlled: boolean;
    expandedIds: Set<string>;
    rowId: (row: Gtk.TreeListRow) => string | undefined;
};

const treeFields = (
    treeRow: Gtk.TreeListRow | null,
    context: TreeRenderContext | undefined,
): { depth?: number; isExpanded?: boolean } => {
    if (treeRow === null) return {};
    const depth = treeRow.getDepth();
    if (context === undefined || !treeRow.isExpandable()) return { depth };
    const isExpanded = context.controlled
        ? context.expandedIds.has(context.rowId(treeRow) ?? "")
        : treeRow.getExpanded();
    return { depth, isExpanded };
};

export const itemRenderer =
    <T, S>(render: (props: RenderItemProps<T>) => ReactNode, context?: TreeRenderContext): CellRenderer<T, S> =>
    (value, treeRow, position) =>
        render({ item: value as T, index: position, ...treeFields(treeRow, context) });

const headerRenderer =
    <T, S>(renderHeader: ((info: { section: S }) => ReactNode) | null | undefined): CellRenderer<T, S> =>
    (value) =>
        renderHeader ? renderHeader({ section: value as S }) : null;

interface HeaderRenderHostProps<T, S> {
    useHeader: boolean;
    store: CellContainerStore;
    resolver: ItemResolver<T, S>;
    renderHeader: ((info: { section: S }) => ReactNode) | null | undefined;
}

export const HeaderRenderHost = <T, S>({
    useHeader,
    store,
    resolver,
    renderHeader,
}: HeaderRenderHostProps<T, S>): ReactNode =>
    useHeader ? <CellRenderHost store={store} resolver={resolver} render={headerRenderer<T, S>(renderHeader)} /> : null;
