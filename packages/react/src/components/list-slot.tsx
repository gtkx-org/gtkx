import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";
import { createElement, memo, type ReactNode, useCallback, useSyncExternalStore } from "react";
import { createPortal } from "../reconciler/portal.js";
import { createElementComponent } from "../utils/create-element-component.js";
import type { ItemResolver } from "../utils/item-resolver.js";
import type { TreeItemMetadata } from "../utils/list-item-flatten.js";
import type { RealizedSlotStore, SlotEntry } from "../utils/realized-slot-store.js";

export type SlotRenderer<T, S> = (
    value: T | S | undefined,
    treeRow: Gtk.TreeListRow | null,
    isHeader: boolean,
) => ReactNode;

interface TreeExpanderElementProps {
    ref?: (value: Gtk.TreeExpander | null) => void;
    hideExpander?: boolean;
    indentForDepth?: boolean;
    indentForIcon?: boolean;
    children?: ReactNode;
}

const GtkTreeExpanderElement = createElementComponent<TreeExpanderElementProps>("GtkTreeExpander");

export interface ListSlotProps<T, S> {
    container: GObject.Object;
    store: RealizedSlotStore;
    resolver: ItemResolver<T, S>;
    render: SlotRenderer<T, S>;
}

const wrapInTreeExpander = (content: ReactNode, treeRow: Gtk.TreeListRow, metadata: TreeItemMetadata): ReactNode =>
    createElement(
        GtkTreeExpanderElement,
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

const SlotImpl = <T, S>({ container, store, resolver, render }: ListSlotProps<T, S>): ReactNode => {
    const subscribe = useCallback(
        (onChange: () => void) => store.subscribePosition(container, onChange),
        [store, container],
    );
    const getSnapshot = useCallback((): SlotEntry => store.getPosition(container), [store, container]);
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

export const ListSlot = memo(SlotImpl) as <T, S>(props: ListSlotProps<T, S>) => ReactNode;
