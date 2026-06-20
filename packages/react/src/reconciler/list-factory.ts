import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";
import { stableIdOf } from "./stable-id.js";

export const UNBOUND_POSITION = -1;

export type ListLifecycleItem = Gtk.ListItem | Gtk.ListHeader;

/**
 * Narrows the `GObject` a `SignalListItemFactory` lifecycle signal delivers to
 * the concrete lifecycle item type. The GIR types the `setup`/`bind`/`unbind`/
 * `teardown` callback argument as a bare `GObject`, but the runtime always
 * passes the factory's own `GtkListItem` (or `GtkListHeader` for header
 * factories). This is the single boundary where that runtime guarantee is
 * applied.
 */
export const asLifecycleItem = <T extends ListLifecycleItem>(obj: GObject.Object): T => obj as T;

/**
 * Options driving {@link connectFactoryLifecycle}. The lifecycle item type `T`
 * and the container type `C` differ when a factory keys its bookkeeping by a
 * widget it creates per item (a `Gtk.TreeExpander`) rather than by the list
 * item itself; the default `createContainer`/`resolveContainer` key by the item.
 */
export type ListFactoryOptions<T extends ListLifecycleItem, C extends GObject.Object = T> = {
    /** Container-to-position map; the factory keeps it current across the lifecycle. */
    containers: Map<C, number>;
    /** Container-to-stable-key map; the factory keeps it current across the lifecycle. */
    containerKeys: Map<C, string>;
    /** Builds (and is the key for) the container a freshly set-up item owns. */
    createContainer: (item: T) => C;
    /** Resolves the container a bound/unbound/torn-down item is keyed by, or `null` when none is tracked. */
    resolveContainer: (item: T) => C | null;
    /** The position a binding reports for `item`, before any refinement. */
    getPosition: (item: T) => number;
    /** Refines the reported position a binding addresses. Defaults to the reported position. */
    resolvePosition?: (item: T, reported: number) => number;
    /** Notifies that the bound-item set changed and portals must rebuild. */
    onBoundItemsChanged: () => void;
    /** Runs after a container is created and registered on setup. */
    onSetup?: (item: T, container: C) => void;
    /** Runs after a binding's position is recorded. */
    onBind?: (item: T, container: C, position: number) => void;
    /** Runs when a binding is released, before the container is marked unbound. */
    onUnbind?: (item: T, container: C) => void;
    /** Runs when a container is torn down, after its bookkeeping is dropped. */
    onTeardown?: (item: T, container: C) => void;
    /** Whether the owning controller has detached, suppressing bind/unbind work. */
    isDetached?: () => boolean;
};

export function connectFactoryLifecycle<T extends ListLifecycleItem, C extends GObject.Object = T>(
    factory: Gtk.SignalListItemFactory,
    options: ListFactoryOptions<T, C>,
): void {
    const {
        containers,
        containerKeys,
        createContainer,
        resolveContainer,
        getPosition,
        onBoundItemsChanged,
        onSetup,
        onBind,
        onUnbind,
        onTeardown,
        isDetached,
    } = options;
    const resolvePosition = options.resolvePosition ?? ((_item: T, reported: number) => reported);

    factory.on("setup", (obj: GObject.Object) => {
        const item = asLifecycleItem<T>(obj);
        const container = createContainer(item);
        containers.set(container, UNBOUND_POSITION);
        containerKeys.set(container, stableIdOf(container));
        onSetup?.(item, container);
    });

    factory.on("bind", (obj: GObject.Object) => {
        if (isDetached?.()) return;
        const item = asLifecycleItem<T>(obj);
        const container = resolveContainer(item);
        if (!container) return;
        const position = resolvePosition(item, getPosition(item));
        containers.set(container, position);
        onBind?.(item, container, position);
        onBoundItemsChanged();
    });

    factory.on("unbind", (obj: GObject.Object) => {
        if (isDetached?.()) return;
        const item = asLifecycleItem<T>(obj);
        const container = resolveContainer(item);
        if (!container) return;
        onUnbind?.(item, container);
        containers.set(container, UNBOUND_POSITION);
        onBoundItemsChanged();
    });

    factory.on("teardown", (obj: GObject.Object) => {
        const item = asLifecycleItem<T>(obj);
        const container = resolveContainer(item);
        if (container) {
            containers.delete(container);
            containerKeys.delete(container);
            onTeardown?.(item, container);
        }
        item.setChild(null);
    });
}
