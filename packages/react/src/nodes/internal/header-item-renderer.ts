import * as Gtk from "@gtkx/ffi/gtk";
import type { ReactNode } from "react";
import type Reconciler from "react-reconciler";
import { createFiberRoot } from "../../fiber-root.js";
import { reconciler } from "../../reconciler.js";
import type { SignalStore } from "./signal-store.js";

type RenderHeaderFn = (item: unknown) => ReactNode;

type ItemResolver = (id: string) => unknown;

export class HeaderItemRenderer {
    private factory: Gtk.SignalListItemFactory;
    private fiberRoots = new Map<object, Reconciler.FiberRoot>();
    private tornDown = new Set<object>();
    private renderFn: RenderHeaderFn | null = () => null;
    private boundHeaders = new Map<string, object>();
    private signalStore: SignalStore;
    private resolveItem: ItemResolver | null = null;

    constructor(signalStore: SignalStore) {
        this.signalStore = signalStore;
        this.factory = new Gtk.SignalListItemFactory();
        this.initializeFactory();
    }

    public getFactory(): Gtk.SignalListItemFactory {
        return this.factory;
    }

    public setResolveItem(resolver: ItemResolver | null): void {
        this.resolveItem = resolver;
    }

    public setRenderFn(renderFn: RenderHeaderFn | null): void {
        this.renderFn = renderFn;
        this.rebindAllHeaders();
    }

    public dispose(): void {
        this.signalStore.clear(this);
        this.fiberRoots.clear();
        this.tornDown.clear();
        this.boundHeaders.clear();
    }

    private rebindAllHeaders(): void {
        for (const [id, header] of this.boundHeaders) {
            const fiberRoot = this.fiberRoots.get(header);
            if (!fiberRoot) continue;
            const item = this.resolveItem?.(id) ?? null;
            const element = this.renderFn?.(item);
            reconciler.getInstance().updateContainer(element, fiberRoot, null, () => {});
        }
    }

    private initializeFactory(): void {
        this.signalStore.set(this, this.factory, "setup", (listHeader: Gtk.ListHeader) => {
            const box = new Gtk.Box(Gtk.Orientation.HORIZONTAL);
            listHeader.setChild(box);
            const fiberRoot = createFiberRoot(box);
            this.fiberRoots.set(listHeader, fiberRoot);
            const element = this.renderFn?.(null);
            reconciler.getInstance().updateContainer(element, fiberRoot, null, () => {});
        });

        this.signalStore.set(this, this.factory, "bind", (listHeader: Gtk.ListHeader) => {
            const fiberRoot = this.fiberRoots.get(listHeader);
            if (!fiberRoot) return;

            const stringObject = listHeader.getItem();
            let id: string | null = null;
            if (stringObject instanceof Gtk.StringObject) {
                id = stringObject.getString();
            }

            if (id !== null) {
                this.boundHeaders.set(id, listHeader);
            }

            const item = id !== null && this.resolveItem ? this.resolveItem(id) : null;
            const element = this.renderFn?.(item);
            reconciler.getInstance().updateContainer(element, fiberRoot, null, () => {});
        });

        this.signalStore.set(this, this.factory, "unbind", (listHeader: Gtk.ListHeader) => {
            const stringObject = listHeader.getItem();
            if (stringObject instanceof Gtk.StringObject) {
                this.boundHeaders.delete(stringObject.getString());
            }
        });

        this.signalStore.set(this, this.factory, "teardown", (listHeader: Gtk.ListHeader) => {
            const fiberRoot = this.fiberRoots.get(listHeader);
            if (fiberRoot) {
                this.tornDown.add(listHeader);
                reconciler.getInstance().updateContainer(null, fiberRoot, null, () => {});
                queueMicrotask(() => {
                    this.fiberRoots.delete(listHeader);
                    this.tornDown.delete(listHeader);
                });
            }
        });
    }
}
