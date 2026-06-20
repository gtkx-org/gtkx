import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";
import { stableIdOf } from "./stable-id.js";

export const UNBOUND_POSITION = -1;

export type ListLifecycleItem = Gtk.ListItem | Gtk.ListHeader;

export const asLifecycleItem = <T extends ListLifecycleItem>(obj: GObject.Object): T => obj as T;

export type ListFactoryOptions<T extends ListLifecycleItem, C extends GObject.Object = T> = {
    containers: Map<C, number>;
    containerKeys: Map<C, string>;
    createContainer: (item: T) => C;
    resolveContainer: (item: T) => C | null;
    getPosition: (item: T) => number;
    resolvePosition?: (item: T, reported: number) => number;
    onBoundItemsChanged: () => void;
    onSetup?: (item: T, container: C) => void;
    onBind?: (item: T, container: C, position: number) => void;
    onUnbind?: (item: T, container: C) => void;
    onTeardown?: (item: T, container: C) => void;
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
