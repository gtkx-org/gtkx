import type * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { type GObjectTarget, useTargetRegistration } from "@gtkx/react/internal";
import { useRef } from "react";
import { CellContainerStore } from "../utils/cell-container-store.js";

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

export interface FactoryInstaller<W extends GObject.Object> {
    install(widget: W, factory: Gtk.SignalListItemFactory): void;
    uninstall(widget: W, factory: Gtk.SignalListItemFactory): void;
}

export interface CellContainersOptions<W extends GObject.Object> {
    target: GObjectTarget<W>;
    installer: FactoryInstaller<W>;
    estimatedHeight?: number | undefined;
    estimatedWidth?: number | undefined;
}

export interface CellContainers {
    store: CellContainerStore;
}

const applyEstimatedSize = (child: Gtk.Widget, height: number | undefined, width: number | undefined): void => {
    if (height === undefined && width === undefined) return;
    child.setSizeRequest(width ?? -1, height ?? -1);
};

export const useCellContainers = <W extends GObject.Object>(options: CellContainersOptions<W>): CellContainers => {
    const { target, installer, estimatedHeight, estimatedWidth } = options;
    const storeRef = useRef<CellContainerStore | null>(null);
    if (storeRef.current === null) storeRef.current = new CellContainerStore();
    const store = storeRef.current;

    const installerRef = useRef(installer);
    installerRef.current = installer;

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
            installerRef.current.install(widget, factory);
            return { widget };
        },
        detach: (registration) => installerRef.current.uninstall(registration.widget, factory),
        isSame: (registration, widget) => registration.widget === widget,
    });

    return { store };
};
