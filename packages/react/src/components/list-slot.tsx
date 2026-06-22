import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";
import { createElement, memo, type ReactNode, useCallback, useSyncExternalStore } from "react";
import { createPortal } from "../reconciler/portal.js";
import { createElementComponent } from "../utils/create-element-component.js";
import type { ItemResolver } from "../utils/item-resolver.js";
import type { TreeItemMetadata } from "../utils/list-item-flatten.js";
import type { RealizedSlotStore, SlotEntry } from "../utils/realized-slot-store.js";

/**
 * Renders the content for one realized position into its container.
 *
 * @typeParam T - The value type of regular items.
 * @typeParam S - The value type of section headers.
 */
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

/**
 * Props for {@link ListSlot}.
 *
 * @typeParam T - The value type of regular items.
 * @typeParam S - The value type of section headers.
 */
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

/**
 * A memoized portal slot for one realized container.
 *
 * The slot subscribes only to its own container's position slice through `useSyncExternalStore`,
 * so a single `bind`/`unbind` re-renders exactly this slot and no sibling. It resolves the value
 * for its position from the `resolver` prop (the data axis, flowing through ordinary React
 * reconciliation) and portals the rendered content into its container. In tree mode the content is
 * wrapped in a `Gtk.TreeExpander` wired to the row and configured with the per-item indentation and
 * expander-visibility metadata. When unbound it renders nothing.
 *
 * @typeParam T - The value type of regular items.
 * @typeParam S - The value type of section headers.
 */
export const ListSlot = memo(SlotImpl) as <T, S>(props: ListSlotProps<T, S>) => ReactNode;
