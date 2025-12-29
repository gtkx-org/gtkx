import { getObjectId } from "@gtkx/ffi";
import * as Gtk from "@gtkx/ffi/gtk";
import type { ReactNode } from "react";
import type Reconciler from "react-reconciler";
import { createFiberRoot } from "../../fiber-root.js";
import { reconciler } from "../../reconciler.js";
import { signalStore } from "./signal-store.js";
import type { TreeStore } from "./tree-store.js";

export type TreeRenderItemFn<T> = (item: T | null, row: Gtk.TreeListRow | null) => ReactNode;

export class TreeListItemRenderer {
    private factory: Gtk.SignalListItemFactory;
    private store?: TreeStore;
    private fiberRoots = new Map<number, Reconciler.FiberRoot>();
    private renderFn?: TreeRenderItemFn<unknown> = () => null as never;

    constructor() {
        this.factory = new Gtk.SignalListItemFactory();
        this.initialize();
    }

    public getFactory(): Gtk.SignalListItemFactory {
        return this.factory;
    }

    public setRenderFn(renderFn?: TreeRenderItemFn<unknown>): void {
        this.renderFn = renderFn;
    }

    public setStore(store?: TreeStore): void {
        this.store = store;
    }

    private getStore(): TreeStore {
        if (!this.store) {
            throw new Error("Expected tree store to be set on TreeListItemRenderer");
        }

        return this.store;
    }

    private initialize(): void {
        signalStore.set(this, this.factory, "setup", (_self, listItem: Gtk.ListItem) => {
            const ptr = getObjectId(listItem.id);

            const expander = new Gtk.TreeExpander();
            const box = new Gtk.Box(Gtk.Orientation.VERTICAL, 0);
            expander.setChild(box);
            listItem.setChild(expander);

            const fiberRoot = createFiberRoot(box);
            this.fiberRoots.set(ptr, fiberRoot);
            const element = this.renderFn?.(null, null);

            reconciler.getInstance().updateContainer(element, fiberRoot, null, () => {});
        });

        signalStore.set(this, this.factory, "bind", (_self, listItem: Gtk.ListItem) => {
            const ptr = getObjectId(listItem.id);
            const fiberRoot = this.fiberRoots.get(ptr);

            if (!fiberRoot) return;

            const treeListRow = listItem.getItem() as Gtk.TreeListRow;
            if (!treeListRow) return;

            const expander = listItem.getChild() as Gtk.TreeExpander;
            expander.setListRow(treeListRow);

            const stringObject = treeListRow.getItem() as Gtk.StringObject;
            if (!stringObject) return;

            const id = stringObject.getString();
            const itemData = this.getStore().getItem(id);

            if (itemData) {
                if (itemData.indentForDepth !== undefined) {
                    expander.setIndentForDepth(itemData.indentForDepth);
                }
                if (itemData.indentForIcon !== undefined) {
                    expander.setIndentForIcon(itemData.indentForIcon);
                }
                if (itemData.hideExpander !== undefined) {
                    expander.setHideExpander(itemData.hideExpander);
                }
            }

            const element = this.renderFn?.(itemData?.value ?? null, treeListRow);

            reconciler.getInstance().updateContainer(element, fiberRoot, null, () => {});
        });

        signalStore.set(this, this.factory, "unbind", (_self, listItem: Gtk.ListItem) => {
            const ptr = getObjectId(listItem.id);
            const fiberRoot = this.fiberRoots.get(ptr);

            if (!fiberRoot) return;

            const expander = listItem.getChild() as Gtk.TreeExpander;
            expander.setListRow(undefined);

            reconciler.getInstance().updateContainer(null, fiberRoot, null, () => {});
        });

        signalStore.set(this, this.factory, "teardown", (_self, listItem) => {
            const ptr = getObjectId(listItem.id);
            const fiberRoot = this.fiberRoots.get(ptr);

            if (fiberRoot) {
                reconciler.getInstance().updateContainer(null, fiberRoot, null, () => {});
                queueMicrotask(() => this.fiberRoots.delete(ptr));
            }
        });
    }
}
