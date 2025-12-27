import { getObjectId } from "@gtkx/ffi";
import * as Gtk from "@gtkx/ffi/gtk";
import type { ReactElement } from "react";
import type Reconciler from "react-reconciler";
import { createFiberRoot } from "../../fiber-root.js";
import { reconciler } from "../../reconciler.js";
import type { ListStore } from "./list-store.js";
import type { SignalStore } from "./signal-store.js";

export type RenderItemFn<T> = (item: T | null) => ReactElement;

export class ListItemRenderer {
    private factory: Gtk.SignalListItemFactory;
    private store?: ListStore;
    private fiberRoots = new Map<number, Reconciler.FiberRoot>();
    private renderFn?: RenderItemFn<unknown> = () => null as never;
    private signalStore: SignalStore;

    constructor(signalStore: SignalStore) {
        this.signalStore = signalStore;
        this.factory = new Gtk.SignalListItemFactory();
        this.initialize();
    }

    public getFactory(): Gtk.SignalListItemFactory {
        return this.factory;
    }

    public setRenderFn(renderFn?: RenderItemFn<unknown>): void {
        this.renderFn = renderFn;
    }

    public setStore(store?: ListStore): void {
        this.store = store;
    }

    private getStore(): ListStore {
        if (!this.store) {
            throw new Error("Expected list store to be set on ListItemRenderer");
        }

        return this.store;
    }

    private initialize(): void {
        this.signalStore.set(this.factory, "setup", (_self, listItem: Gtk.ListItem) => {
            const ptr = getObjectId(listItem.id);

            const box = new Gtk.Box(Gtk.Orientation.VERTICAL, 0);
            listItem.setChild(box);

            const fiberRoot = createFiberRoot(box);
            this.fiberRoots.set(ptr, fiberRoot);
            const element = this.renderFn?.(null);

            reconciler.getInstance().updateContainer(element, fiberRoot, null, () => {});
        });

        this.signalStore.set(this.factory, "bind", (_self, listItem: Gtk.ListItem) => {
            const ptr = getObjectId(listItem.id);
            const fiberRoot = this.fiberRoots.get(ptr);

            if (!fiberRoot) return;

            const id = listItem.getItem() as Gtk.StringObject;
            const item = this.getStore().getItem(id.getString());
            const element = this.renderFn?.(item);

            reconciler.getInstance().updateContainer(element, fiberRoot, null, () => {});
        });

        this.signalStore.set(this.factory, "unbind", (_self, listItem: Gtk.ListItem) => {
            const ptr = getObjectId(listItem.id);
            const fiberRoot = this.fiberRoots.get(ptr);

            if (!fiberRoot) return;

            reconciler.getInstance().updateContainer(null, fiberRoot, null, () => {});
        });

        this.signalStore.set(this.factory, "teardown", (_self, listItem) => {
            const ptr = getObjectId(listItem.id);
            const fiberRoot = this.fiberRoots.get(ptr);

            if (fiberRoot) {
                reconciler.getInstance().updateContainer(null, fiberRoot, null, () => {});
                queueMicrotask(() => this.fiberRoots.delete(ptr));
            }
        });
    }
}
