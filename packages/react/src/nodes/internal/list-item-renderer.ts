import { getNativeId } from "@gtkx/ffi";
import * as Gtk from "@gtkx/ffi/gtk";
import type { ReactNode } from "react";
import type Reconciler from "react-reconciler";
import { createFiberRoot } from "../../fiber-root.js";
import { reconciler } from "../../reconciler.js";
import type { ListStore } from "./list-store.js";
import { signalStore } from "./signal-store.js";

export type RenderItemFn<T> = (item: T | null) => ReactNode;

export class ListItemRenderer {
    private factory: Gtk.SignalListItemFactory;
    private store?: ListStore | null;
    private fiberRoots = new Map<number, Reconciler.FiberRoot>();
    private tornDown = new Set<number>();
    private renderFn?: RenderItemFn<unknown> = () => null as never;
    private estimatedItemHeight?: number;

    constructor() {
        this.factory = new Gtk.SignalListItemFactory();
        this.initialize();
    }

    public getFactory(): Gtk.SignalListItemFactory {
        return this.factory;
    }

    public setRenderFn(renderFn?: RenderItemFn<unknown>): void {
        this.renderFn = renderFn;
    }

    public setStore(store?: ListStore | null): void {
        this.store = store;
    }

    public setEstimatedItemHeight(height?: number): void {
        this.estimatedItemHeight = height;
    }

    private getStore(): ListStore {
        if (!this.store) {
            throw new Error("Expected list store to be set on ListItemRenderer");
        }

        return this.store;
    }

    private initialize(): void {
        signalStore.set(this, this.factory, "setup", (_self, listItem: Gtk.ListItem) => {
            const ptr = getNativeId(listItem.handle);

            const box = new Gtk.Box(Gtk.Orientation.VERTICAL);

            if (this.estimatedItemHeight !== undefined) {
                box.setSizeRequest(-1, this.estimatedItemHeight);
            }

            listItem.setChild(box);

            const fiberRoot = createFiberRoot(box);
            this.fiberRoots.set(ptr, fiberRoot);
            const element = this.renderFn?.(null);

            reconciler.getInstance().updateContainer(element, fiberRoot, null, () => {});
        });

        signalStore.set(this, this.factory, "bind", (_self, listItem: Gtk.ListItem) => {
            const ptr = getNativeId(listItem.handle);
            const fiberRoot = this.fiberRoots.get(ptr);

            if (!fiberRoot) return;

            const stringObject = listItem.getItem();
            if (!(stringObject instanceof Gtk.StringObject)) return;
            const item = this.getStore().getItem(stringObject.getString());
            const element = this.renderFn?.(item);

            reconciler.getInstance().updateContainer(element, fiberRoot, null, () => {
                if (this.tornDown.has(ptr)) return;
                const currentFiberRoot = this.fiberRoots.get(ptr);
                if (!currentFiberRoot) return;
                const box = currentFiberRoot.containerInfo;
                if (box instanceof Gtk.Box) {
                    box.setSizeRequest(-1, -1);
                }
            });
        });

        signalStore.set(this, this.factory, "unbind", () => {});

        signalStore.set(this, this.factory, "teardown", (_self, listItem) => {
            const ptr = getNativeId(listItem.handle);
            const fiberRoot = this.fiberRoots.get(ptr);

            if (fiberRoot) {
                this.tornDown.add(ptr);
                reconciler.getInstance().updateContainer(null, fiberRoot, null, () => {});
                queueMicrotask(() => {
                    this.fiberRoots.delete(ptr);
                    this.tornDown.delete(ptr);
                });
            }
        });
    }
}
