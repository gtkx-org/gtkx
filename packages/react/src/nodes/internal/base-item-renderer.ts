import * as Gtk from "@gtkx/ffi/gtk";
import type { ReactNode } from "react";
import type Reconciler from "react-reconciler";
import { createFiberRoot } from "../../fiber-root.js";
import { reconciler } from "../../reconciler.js";
import type { SignalStore } from "./signal-store.js";

export abstract class BaseItemRenderer<TStore = unknown> {
    protected factory: Gtk.SignalListItemFactory;
    protected fiberRoots = new Map<Gtk.ListItem, Reconciler.FiberRoot>();
    protected tornDown = new Set<Gtk.ListItem>();
    protected estimatedItemHeight: number | null = null;
    private store: TStore | null = null;
    protected signalStore: SignalStore;

    constructor(signalStore: SignalStore) {
        this.signalStore = signalStore;
        this.factory = new Gtk.SignalListItemFactory();
        this.initializeFactory();
    }

    public getFactory(): Gtk.SignalListItemFactory {
        return this.factory;
    }

    public setEstimatedItemHeight(height: number | null): void {
        this.estimatedItemHeight = height;
    }

    public setStore(store: TStore | null): void {
        this.store = store;
    }

    protected getStore(): TStore {
        if (!this.store) {
            throw new Error(`Expected store to be set on ${this.constructor.name}`);
        }
        return this.store;
    }

    public dispose(): void {
        this.signalStore.clear(this);
        this.fiberRoots.clear();
        this.tornDown.clear();
    }

    protected abstract renderItem(listItem: Gtk.ListItem): ReactNode;
    protected abstract onSetup(listItem: Gtk.ListItem): Gtk.Widget;
    protected abstract onBind(listItem: Gtk.ListItem, fiberRoot: Reconciler.FiberRoot): void;
    protected abstract onUnbind(listItem: Gtk.ListItem): void;

    protected onSetupComplete(_listItem: Gtk.ListItem): void {}
    protected onTeardown(_listItem: Gtk.ListItem): void {}

    protected createBox(): Gtk.Box {
        const box = new Gtk.Box(Gtk.Orientation.HORIZONTAL);

        if (this.estimatedItemHeight !== null) {
            box.setSizeRequest(-1, this.estimatedItemHeight);
        }

        return box;
    }

    protected clearBoxSizeRequest(box: Gtk.Widget): void {
        if (box instanceof Gtk.Box) {
            box.setSizeRequest(-1, -1);
        }
    }

    private initializeFactory(): void {
        this.signalStore.set(this, this.factory, "setup", (listItem: Gtk.ListItem) => {
            const container = this.onSetup(listItem);
            const fiberRoot = createFiberRoot(container);
            this.fiberRoots.set(listItem, fiberRoot);
            const element = this.renderItem(listItem);
            reconciler.getInstance().updateContainer(element, fiberRoot, null, () => {
                if (this.tornDown.has(listItem)) return;
                this.onSetupComplete(listItem);
            });
        });

        this.signalStore.set(this, this.factory, "bind", (listItem: Gtk.ListItem) => {
            const fiberRoot = this.fiberRoots.get(listItem);
            if (!fiberRoot) return;
            this.onBind(listItem, fiberRoot);
        });

        this.signalStore.set(this, this.factory, "unbind", (listItem: Gtk.ListItem) => {
            this.onUnbind(listItem);
        });

        this.signalStore.set(this, this.factory, "teardown", (listItem: Gtk.ListItem) => {
            const fiberRoot = this.fiberRoots.get(listItem);

            if (fiberRoot) {
                this.tornDown.add(listItem);
                this.onTeardown(listItem);
                reconciler.getInstance().updateContainer(null, fiberRoot, null, () => {});
                queueMicrotask(() => {
                    this.fiberRoots.delete(listItem);
                    this.tornDown.delete(listItem);
                });
            }
        });
    }
}
