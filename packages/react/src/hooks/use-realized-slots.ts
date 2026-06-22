import type * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { useRef } from "react";
import type { GObjectTarget } from "../utils/gobject-target.js";
import { RealizedSlotStore } from "../utils/realized-slot-store.js";
import { useTargetRegistration } from "../utils/use-target-registration.js";

interface ChildContainer {
    getChild(): Gtk.Widget | null;
    setChild(child: Gtk.Widget | null): void;
    getItem(): GObject.Object | null;
}

const isChildContainer = (container: GObject.Object): container is GObject.Object & ChildContainer =>
    container instanceof Gtk.ListItem || container instanceof Gtk.ListHeader;

const positionOf = (container: GObject.Object & ChildContainer): number => {
    if (container instanceof Gtk.ListItem) return container.getPosition();
    if (container instanceof Gtk.ListHeader) return container.getStart();
    return -1;
};

/**
 * Installs and removes a factory on a GObject that owns one.
 *
 * @typeParam W - The GObject type that owns the factory (a view widget or a column).
 */
export interface FactoryBinding<W extends GObject.Object> {
    install(widget: W, factory: Gtk.SignalListItemFactory): void;
    uninstall(widget: W, factory: Gtk.SignalListItemFactory): void;
}

/**
 * Configuration for {@link useRealizedSlots}.
 *
 * @typeParam W - The GObject type that owns the factory.
 */
export interface RealizedSlotsOptions<W extends GObject.Object> {
    target: GObjectTarget<W>;
    binding: FactoryBinding<W>;
    estimatedHeight?: number | undefined;
    estimatedWidth?: number | undefined;
}

/**
 * The factory and external store wiring the GTK realization signals to React slots.
 */
export interface RealizedSlots {
    factory: Gtk.SignalListItemFactory;
    store: RealizedSlotStore;
}

const applyEstimatedSize = (child: Gtk.Widget, height: number | undefined, width: number | undefined): void => {
    if (height === undefined && width === undefined) return;
    child.setSizeRequest(width ?? -1, height ?? -1);
};

/**
 * Creates one `Gtk.SignalListItemFactory` and a {@link RealizedSlotStore}, translating the
 * factory's `setup`/`bind`/`unbind`/`teardown` signals into synchronous store writes.
 *
 * At `setup` an empty placeholder child is installed (carrying any estimated size request) so the
 * container measures correctly before binding. At `bind` the container's position and tree row are
 * captured into the store, notifying only that container's subscribers. There is no deferral: the
 * store writes and listener notifications run inside the signal handler so React batches them in
 * the surrounding render or act window.
 *
 * @typeParam W - The widget type that owns the factory.
 * @param options - The target widget, the factory binding, and optional estimated sizes.
 * @returns The factory to install on the widget and the store the portals subscribe to.
 */
export const useRealizedSlots = <W extends GObject.Object>(options: RealizedSlotsOptions<W>): RealizedSlots => {
    const { target, binding, estimatedHeight, estimatedWidth } = options;
    const storeRef = useRef<RealizedSlotStore | null>(null);
    if (storeRef.current === null) storeRef.current = new RealizedSlotStore();
    const store = storeRef.current;

    const bindingRef = useRef(binding);
    bindingRef.current = binding;

    const factoryRef = useRef<Gtk.SignalListItemFactory | null>(null);
    if (factoryRef.current === null) {
        const factory = Gtk.SignalListItemFactory.new();
        factory.on("setup", (container) => {
            if (isChildContainer(container) && container.getChild() === null) {
                const placeholder = new Gtk.Box();
                applyEstimatedSize(placeholder, estimatedHeight, estimatedWidth);
                container.setChild(placeholder);
            }
            store.addContainer(container);
        });
        factory.on("bind", (container) => {
            if (isChildContainer(container)) {
                const item = container.getItem();
                const treeRow = item instanceof Gtk.TreeListRow ? item : null;
                store.bind(container, positionOf(container), treeRow, item);
            } else {
                store.bind(container, -1, null, null);
            }
        });
        factory.on("unbind", (container) => {
            store.unbind(container);
        });
        factory.on("teardown", (container) => {
            store.removeContainer(container);
        });
        factoryRef.current = factory;
    }
    const factory = factoryRef.current;

    useTargetRegistration<W, { widget: W }>(target, {
        attach: (widget) => {
            bindingRef.current.install(widget, factory);
            return { widget };
        },
        detach: (registration) => bindingRef.current.uninstall(registration.widget, factory),
        isSame: (registration, widget) => registration.widget === widget,
    });

    return { factory, store };
};
