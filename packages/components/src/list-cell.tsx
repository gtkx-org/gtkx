import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkTreeExpander } from "@gtkx/jsx/gtk";
import { createPortal } from "@gtkx/react";
import { createElement, memo, type ReactNode, useCallback, useSyncExternalStore } from "react";
import type { CellContainerStore, CellEntry } from "./utils/cell-container-store.js";
import type { ItemResolver } from "./utils/item-resolver.js";
import type { TreeItemMetadata } from "./utils/list-item-flatten.js";

export type CellRenderer<T, S> = (
    value: T | S | undefined,
    treeRow: Gtk.TreeListRow | null,
    isHeader: boolean,
) => ReactNode;

export interface ListCellProps<T, S> {
    container: GObject.Object;
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

const CellImpl = <T, S>({ container, store, resolver, render }: ListCellProps<T, S>): ReactNode => {
    const subscribe = useCallback(
        (onChange: () => void) => store.subscribePosition(container, onChange),
        [store, container],
    );
    const getSnapshot = useCallback((): CellEntry => store.getPosition(container), [store, container]);
    const entry = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    if (entry.position < 0) return null;
    const resolved = resolver.resolve(entry.position, entry.treeRow, entry.item);
    if (!resolved.present) return null;
    const content = render(resolved.value, resolved.treeRow, resolved.isHeader);
    const portalled =
        resolved.treeRow !== null && !resolved.isHeader
            ? wrapInTreeExpander(content, resolved.treeRow, resolved.metadata)
            : content;
    return createPortal(portalled, container, store.keyFor(container));
};

export const ListCell = memo(CellImpl) as <T, S>(props: ListCellProps<T, S>) => ReactNode;
