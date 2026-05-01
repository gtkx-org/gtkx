import { getNativeId } from "@gtkx/ffi";
import type * as GObject from "@gtkx/ffi/gobject";
import type * as Gtk from "@gtkx/ffi/gtk";

export const UNBOUND_POSITION = -1;

export type ListLifecycleItem = Gtk.ListItem | Gtk.ListHeader;

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

    factory.connect("setup", (_self: GObject.Object, obj: GObject.Object) => {
        const item = obj as unknown as T;
        containers.set(item, UNBOUND_POSITION);
        containerKeys.set(item, String(getNativeId(item.handle)));
        onSetup?.(item);
    });

    factory.connect("bind", (_self: GObject.Object, obj: GObject.Object) => {
        if (isDisposed?.()) return;
        const item = obj as unknown as T;
        containers.set(item, getPosition(item));
        onBoundItemsChanged();
    });

    factory.connect("unbind", (_self: GObject.Object, obj: GObject.Object) => {
        if (isDisposed?.()) return;
        const item = obj as unknown as T;
        containers.set(item, UNBOUND_POSITION);
        onBoundItemsChanged();
    });

    factory.connect("teardown", (_self: GObject.Object, obj: GObject.Object) => {
        const item = obj as unknown as T;
        containers.delete(item);
        containerKeys.delete(item);
        item.setChild(null);
    });
}
