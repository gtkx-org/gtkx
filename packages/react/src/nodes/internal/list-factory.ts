import type * as GObject from "@gtkx/ffi/gobject";
import type * as Gtk from "@gtkx/ffi/gtk";
import { widgetIdOf } from "./widget-id.js";

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

export interface ListFactoryOptions<T extends ListLifecycleItem> {
    containers: Map<T, number>;
    containerKeys: Map<T, string>;
    getPosition: (item: T) => number;
    onBoundItemsChanged: () => void;
    onSetup?: (item: T) => void;
    isDisposed?: () => boolean;
}

export function connectFactoryLifecycle<T extends ListLifecycleItem>(
    factory: Gtk.SignalListItemFactory,
    options: ListFactoryOptions<T>,
): void {
    const { containers, containerKeys, getPosition, onBoundItemsChanged, onSetup, isDisposed } = options;

    factory.connect("setup", (obj: GObject.Object) => {
        const item = asLifecycleItem<T>(obj);
        containers.set(item, UNBOUND_POSITION);
        containerKeys.set(item, widgetIdOf(item));
        onSetup?.(item);
    });

    factory.connect("bind", (obj: GObject.Object) => {
        if (isDisposed?.()) return;
        const item = asLifecycleItem<T>(obj);
        containers.set(item, getPosition(item));
        onBoundItemsChanged();
    });

    factory.connect("unbind", (obj: GObject.Object) => {
        if (isDisposed?.()) return;
        const item = asLifecycleItem<T>(obj);
        containers.set(item, UNBOUND_POSITION);
        onBoundItemsChanged();
    });

    factory.connect("teardown", (obj: GObject.Object) => {
        const item = asLifecycleItem<T>(obj);
        containers.delete(item);
        containerKeys.delete(item);
        item.setChild(null);
    });
}
