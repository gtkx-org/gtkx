import { getNativeId } from "@gtkx/ffi";
import * as Gtk from "@gtkx/ffi/gtk";
import type { ReactNode } from "react";
import type Reconciler from "react-reconciler";
import { createFiberRoot } from "../../fiber-root.js";
import { reconciler } from "../../reconciler.js";
import { signalStore } from "./signal-store.js";
import type { TreeStore } from "./tree-store.js";

export type TreeRenderItemFn<T> = (item: T | null, row: Gtk.TreeListRow | null) => ReactNode;

interface PendingBind {
    treeListRow: Gtk.TreeListRow;
    expander: Gtk.TreeExpander;
    id: string;
}

export class TreeListItemRenderer {
    private factory: Gtk.SignalListItemFactory;
    private store?: TreeStore | null;
    private fiberRoots = new Map<number, Reconciler.FiberRoot>();
    private expanders = new Map<number, Gtk.TreeExpander>();
    private setupComplete = new Set<number>();
    private pendingBinds = new Map<number, PendingBind>();
    private tornDown = new Set<number>();
    private renderFn?: TreeRenderItemFn<unknown> = () => null as never;
    private estimatedItemHeight?: number;

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

    public setStore(store?: TreeStore | null): void {
        this.store = store;
    }

    public setEstimatedItemHeight(height?: number): void {
        this.estimatedItemHeight = height;
    }

    private getStore(): TreeStore {
        if (!this.store) {
            throw new Error("Expected tree store to be set on TreeListItemRenderer");
        }

        return this.store;
    }

    private initialize(): void {
        signalStore.set(this, this.factory, "setup", (_self, listItem: Gtk.ListItem) => {
            const ptr = getNativeId(listItem.handle);

            const expander = new Gtk.TreeExpander();
            const box = new Gtk.Box(Gtk.Orientation.VERTICAL);

            if (this.estimatedItemHeight !== undefined) {
                box.setSizeRequest(-1, this.estimatedItemHeight);
            }

            expander.setChild(box);
            listItem.setChild(expander);

            const fiberRoot = createFiberRoot(box);
            this.fiberRoots.set(ptr, fiberRoot);
            this.expanders.set(ptr, expander);

            const element = this.renderFn?.(null, null);
            reconciler.getInstance().updateContainer(element, fiberRoot, null, () => {
                if (this.tornDown.has(ptr)) return;
                this.setupComplete.add(ptr);
                this.processPendingBind(ptr);
            });
        });

        signalStore.set(this, this.factory, "bind", (_self, listItem: Gtk.ListItem) => {
            const ptr = getNativeId(listItem.handle);
            const fiberRoot = this.fiberRoots.get(ptr);
            const expander = this.expanders.get(ptr);

            if (!fiberRoot || !expander) return;

            const treeListRow = listItem.getItem();
            if (!(treeListRow instanceof Gtk.TreeListRow)) return;

            expander.setListRow(treeListRow);

            const stringObject = treeListRow.getItem();
            if (!(stringObject instanceof Gtk.StringObject)) return;

            const id = stringObject.getString();

            if (!this.setupComplete.has(ptr)) {
                this.pendingBinds.set(ptr, { treeListRow, expander, id });
                return;
            }

            this.renderBind(ptr, expander, treeListRow, id);
        });

        signalStore.set(this, this.factory, "unbind", (_self, listItem: Gtk.ListItem) => {
            const expander = listItem.getChild();
            if (expander instanceof Gtk.TreeExpander) {
                expander.setListRow(null);
            }
        });

        signalStore.set(this, this.factory, "teardown", (_self, listItem) => {
            const ptr = getNativeId(listItem.handle);
            const fiberRoot = this.fiberRoots.get(ptr);

            if (fiberRoot) {
                this.tornDown.add(ptr);
                reconciler.getInstance().updateContainer(null, fiberRoot, null, () => {});
                queueMicrotask(() => {
                    this.fiberRoots.delete(ptr);
                    this.expanders.delete(ptr);
                    this.setupComplete.delete(ptr);
                    this.pendingBinds.delete(ptr);
                    this.tornDown.delete(ptr);
                });
            }
        });
    }

    private processPendingBind(ptr: number): void {
        const pending = this.pendingBinds.get(ptr);
        if (!pending) return;

        this.pendingBinds.delete(ptr);
        this.renderBind(ptr, pending.expander, pending.treeListRow, pending.id);
    }

    private renderBind(ptr: number, expander: Gtk.TreeExpander, treeListRow: Gtk.TreeListRow, id: string): void {
        const fiberRoot = this.fiberRoots.get(ptr);
        if (!fiberRoot) return;

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

        reconciler.getInstance().updateContainer(element, fiberRoot, null, () => {
            if (this.tornDown.has(ptr)) return;
            const currentExpander = this.expanders.get(ptr);
            if (!currentExpander) return;
            const box = currentExpander.getChild();
            if (box instanceof Gtk.Box) {
                box.setSizeRequest(-1, -1);
            }
        });
    }
}
