import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkTreeExpander } from "@gtkx/jsx/gtk";
import { createPortal } from "@gtkx/react";
import { createElement, Fragment, memo, type ReactNode, useCallback, useSyncExternalStore } from "react";
import type { CellContainerStore, CellEntry } from "./utils/cell-container-store.js";
import type { ItemResolver } from "./utils/item-resolver.js";
import type { TreeItemMetadata } from "./utils/list-item-flatten.js";

/**
 * Renders the content for a single cell given its resolved value, owning tree
 * row, and its bound list position. Section-header cells reuse this shape but
 * receive only their value; the tree row and position are ignored.
 */
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

const wrapInTreeExpander = (content: ReactNode, treeRow: Gtk.TreeListRow, metadata: TreeItemMetadata): ReactNode =>
    createElement(
        GtkTreeExpander,
        {
            ref: (expander: Gtk.TreeExpander | null) => {
                if (expander !== null) expander.setListRow(treeRow);
            },
            hideExpander: metadata.hideExpander,
            indentForDepth: metadata.indentForDepth,
            indentForIcon: metadata.indentForIcon,
        },
        content,
    );

const Cell = memo(<T, S>({ container, store, resolver, render }: CellProps<T, S>): ReactNode => {
    const subscribe = useCallback(
        (onChange: () => void) => store.subscribePosition(container, onChange),
        [store, container],
    );
    const getSnapshot = useCallback((): CellEntry => store.getPosition(container), [store, container]);
    const entry = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    if (entry.position < 0) return null;
    const resolved = resolver.resolve(entry.position, entry.treeRow, entry.item);
    if (!resolved.present) return null;
    const content = render(resolved.value, resolved.treeRow, entry.position);
    const portalled =
        resolved.treeRow !== null && !resolved.isHeader
            ? wrapInTreeExpander(content, resolved.treeRow, resolved.metadata)
            : content;
    return createPortal(portalled, container, store.keyFor(container));
}) as <T, S>(props: CellProps<T, S>) => ReactNode;

/**
 * Renders one {@link Cell} per container tracked by the given store, portalling
 * each cell's content into its container and keeping it in sync as positions
 * change.
 */
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

/**
 * Builds a {@link CellRenderer} that renders item cells through `render`,
 * passing the resolved value and bound list position as a `{ item, index }`
 * info object.
 */
export const itemRenderer =
    <T, S>(render: (info: { item: T; index: number }) => ReactNode): CellRenderer<T, S> =>
    (value, _treeRow, position) =>
        render({ item: value as T, index: position });

/**
 * Builds a {@link CellRenderer} that renders section headers through
 * `renderHeader`, passing the resolved section value as a `{ section }` info
 * object, and returning nothing when no header renderer is supplied.
 */
export const headerRenderer =
    <T, S>(renderHeader: ((info: { section: S }) => ReactNode) | null | undefined): CellRenderer<T, S> =>
    (value) =>
        renderHeader ? renderHeader({ section: value as S }) : null;
