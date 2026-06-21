import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";
import { type BoundContainerRegistry, UNBOUND_POSITION } from "./bound-container-registry.js";

export type ListLifecycleItem = Gtk.ListItem | Gtk.ListHeader;

export const asLifecycleItem = <T extends ListLifecycleItem>(obj: GObject.Object): T => obj as T;

export type ListFactoryOptions<T extends ListLifecycleItem, C extends GObject.Object = T> = {
    registry: BoundContainerRegistry<C>;
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
        registry,
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
        registry.register(container);
        onSetup?.(item, container);
    });

    factory.on("bind", (obj: GObject.Object) => {
        if (isDetached?.()) return;
        const item = asLifecycleItem<T>(obj);
        const container = resolveContainer(item);
        if (!container) return;
        const position = resolvePosition(item, getPosition(item));
        registry.setPosition(container, position);
        onBind?.(item, container, position);
        onBoundItemsChanged();
    });

    factory.on("unbind", (obj: GObject.Object) => {
        if (isDetached?.()) return;
        const item = asLifecycleItem<T>(obj);
        const container = resolveContainer(item);
        if (!container) return;
        onUnbind?.(item, container);
        registry.setPosition(container, UNBOUND_POSITION);
        onBoundItemsChanged();
    });

    factory.on("teardown", (obj: GObject.Object) => {
        const item = asLifecycleItem<T>(obj);
        const container = resolveContainer(item);
        if (container) {
            registry.delete(container);
            onTeardown?.(item, container);
        }
        item.setChild(null);
    });
}
